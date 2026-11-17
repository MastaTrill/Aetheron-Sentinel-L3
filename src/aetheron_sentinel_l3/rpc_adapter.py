from __future__ import annotations

import hashlib
import json
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import count
from typing import Callable

from .execution import OnChainAdapter, OperationReceipt

_LOOPBACK_SERVERS: dict[str, "LocalTestnetRpcServer"] = {}
_LOOPBACK_SEQ = count(1)


@dataclass
class JsonRpcAdapterConfig:
    chain_name: str
    endpoint: str
    confirmations_required: int = 1
    poll_attempts: int = 3
    poll_interval_seconds: float = 0.0
    transport_retries: int = 0
    retry_backoff_seconds: float = 0.0
    expected_chain_id: int | None = None


@dataclass(frozen=True)
class ChainEndpointStatus:
    chain_name: str
    endpoint: str
    chain_id: int
    block_number: int
    healthy: bool


class JsonRpcAdapterError(RuntimeError):
    """Base class for JSON-RPC adapter failures."""


class RpcTransportError(JsonRpcAdapterError):
    """Raised when the HTTP/transport layer fails."""


class RpcSubmissionError(JsonRpcAdapterError):
    """Raised when control submission does not return a valid tx hash."""


class RpcResponseError(JsonRpcAdapterError):
    """Raised for explicit JSON-RPC error payloads."""


class JsonRpcOnChainAdapter(OnChainAdapter):
    """JSON-RPC execution adapter with pluggable transport, live chain probes, and receipt polling."""

    def __init__(self, config: JsonRpcAdapterConfig, transport: Callable[[str, dict], dict] | None = None) -> None:
        if config.confirmations_required < 1:
            raise ValueError("confirmations_required must be >= 1")
        if config.poll_attempts < 1:
            raise ValueError("poll_attempts must be >= 1")
        if config.poll_interval_seconds < 0:
            raise ValueError("poll_interval_seconds must be >= 0")
        if config.transport_retries < 0:
            raise ValueError("transport_retries must be >= 0")
        if config.retry_backoff_seconds < 0:
            raise ValueError("retry_backoff_seconds must be >= 0")
        self.config = config
        self._transport = transport or self._default_transport
        self._finalized: dict[str, bool] = {}
        self._rolled_back: set[str] = set()
        self._request_ids = count(1)

    def probe_endpoint(self) -> ChainEndpointStatus:
        """Validates live JSON-RPC endpoint connectivity, chainId, and block height."""
        raw_chain_id = self._rpc_raw("eth_chainId", [])
        raw_block = self._rpc_raw("eth_blockNumber", [])
        chain_id = self._parse_hex_or_int(raw_chain_id)
        block_number = self._parse_hex_or_int(raw_block)
        if chain_id <= 0:
            raise RpcResponseError(f"invalid chain_id from endpoint: {raw_chain_id}")
        healthy = True
        if self.config.expected_chain_id is not None and chain_id != self.config.expected_chain_id:
            healthy = False
        return ChainEndpointStatus(
            chain_name=self.config.chain_name,
            endpoint=self.config.endpoint,
            chain_id=chain_id,
            block_number=block_number,
            healthy=healthy,
        )

    def apply(self, control: str, op_id: str) -> OperationReceipt:
        submit_method = self._control_method(control)
        tx_hash = self._rpc(submit_method, {"op_id": op_id, "control": control})
        if not isinstance(tx_hash, str) or not tx_hash:
            raise RpcSubmissionError("rpc submit returned invalid transaction hash")
        finalized = self._wait_for_finality(tx_hash)
        self._finalized[tx_hash] = finalized
        return OperationReceipt(op_id=op_id, control=control, status="submitted", tx_hash=tx_hash, finalized=finalized)

    def apply_with_rollback_guard(self, control: str, op_id: str) -> tuple[OperationReceipt, bool]:
        """Applies control and automatically executes compensating rollback if finality fails."""
        receipt = self.apply(control, op_id)
        if not self.verify(receipt):
            self.rollback(control, op_id)
            return receipt, True
        return receipt, False

    def rollback(self, control: str, op_id: str) -> None:
        _ = self._rpc("aetheron_rollbackControl", {"op_id": op_id, "control": control})
        self._rolled_back.add(f"{op_id}:{control}")

    def verify(self, receipt: OperationReceipt) -> bool:
        if f"{receipt.op_id}:{receipt.control}" in self._rolled_back:
            return False
        return self._finalized.get(receipt.tx_hash, False) and receipt.finalized

    def _wait_for_finality(self, tx_hash: str) -> bool:
        for attempt in range(self.config.poll_attempts):
            receipt = self._rpc("eth_getTransactionReceipt", {"tx_hash": tx_hash})
            if not isinstance(receipt, dict):
                if self.config.poll_interval_seconds > 0 and attempt < self.config.poll_attempts - 1:
                    time.sleep(self.config.poll_interval_seconds)
                continue
            status = receipt.get("status")
            if status in {"0x0", 0, "failed"}:
                return False
            confirmations = self._resolve_confirmations(receipt)
            if confirmations >= self.config.confirmations_required:
                return True
            if self.config.poll_interval_seconds > 0 and attempt < self.config.poll_attempts - 1:
                time.sleep(self.config.poll_interval_seconds)
        return False

    def _resolve_confirmations(self, receipt: dict) -> int:
        if "confirmations" in receipt:
            return self._parse_confirmations(receipt)
        if "blockNumber" in receipt and receipt["blockNumber"] is not None:
            tx_block = self._parse_hex_or_int(receipt["blockNumber"])
            try:
                latest_raw = self._rpc_raw("eth_blockNumber", [])
                latest_block = self._parse_hex_or_int(latest_raw)
                if latest_block >= tx_block > 0:
                    return (latest_block - tx_block) + 1
            except Exception:
                return 1 if tx_block > 0 else 0
        return 0

    def _control_method(self, control: str) -> str:
        return {
            "pause_bridge": "aetheron_pauseBridge",
            "enable_withdrawal_caps": "aetheron_setWithdrawalCaps",
            "add_time_delay": "aetheron_setDelay",
        }.get(control, "aetheron_applyControl")

    def _rpc(self, method: str, params: dict):
        return self._rpc_raw(method, [params])

    def _rpc_raw(self, method: str, params: list):
        response = None
        for attempt in range(self.config.transport_retries + 1):
            try:
                response = self._transport(
                    self.config.endpoint,
                    {"jsonrpc": "2.0", "id": next(self._request_ids), "method": method, "params": params},
                )
                break
            except Exception as exc:
                if attempt >= self.config.transport_retries:
                    raise RpcTransportError(f"transport failure for method {method}") from exc
                if self.config.retry_backoff_seconds > 0:
                    time.sleep(self.config.retry_backoff_seconds * (attempt + 1))
        if not isinstance(response, dict):
            raise RpcResponseError(f"rpc response is not an object for method {method}")
        if "error" in response:
            raise RpcResponseError(f"rpc error: {response['error']}")
        return response.get("result")

    @staticmethod
    def _parse_confirmations(receipt: dict) -> int:
        return JsonRpcOnChainAdapter._parse_hex_or_int(receipt.get("confirmations", 0))

    @staticmethod
    def _parse_hex_or_int(value) -> int:
        try:
            if isinstance(value, str):
                if value.startswith(("0x", "0X")):
                    return int(value, 16)
                return int(value)
            if isinstance(value, int):
                return value
        except ValueError:
            return 0
        return 0

    @staticmethod
    def _default_transport(endpoint: str, payload: dict) -> dict:
        raw_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=raw_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            if isinstance(exc.reason, PermissionError) and endpoint in _LOOPBACK_SERVERS:
                raw_resp = _LOOPBACK_SERVERS[endpoint].handle_raw_bytes(raw_data)
                return json.loads(raw_resp.decode("utf-8"))
            raise


class LocalTestnetRpcServer:
    """In-process HTTP JSON-RPC 2.0 server emulating Base Sepolia + Aetheron Sentinel L3 RPC."""

    def __init__(
        self,
        chain_id: int = 84532,
        initial_block: int = 10_000_000,
        revert_controls: set[str] | None = None,
        blocks_per_poll: int = 1,
    ) -> None:
        self.chain_id = chain_id
        self.block_number = initial_block
        self.revert_controls = set(revert_controls or ())
        self.blocks_per_poll = blocks_per_poll
        self.transactions: dict[str, dict] = {}
        self.rollbacks: list[dict] = []
        self.requests: list[dict] = []
        self._lock = threading.Lock()
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._endpoint: str | None = None

    @property
    def endpoint(self) -> str:
        if self._endpoint is None:
            raise RuntimeError("LocalTestnetRpcServer is not running")
        return self._endpoint

    def handle_raw_bytes(self, raw_data: bytes) -> bytes:
        payload = json.loads(raw_data.decode("utf-8"))
        response = self._handle_rpc(payload)
        return json.dumps(response).encode("utf-8")

    def __enter__(self) -> "LocalTestnetRpcServer":
        parent = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length)
                body = parent.handle_raw_bytes(raw)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, format: str, *args) -> None:
                return

        try:
            self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
            self._thread.start()
            host, port = self._server.server_address
            self._endpoint = f"http://{host}:{port}"
        except PermissionError:
            self._endpoint = f"http://127.0.0.1:{58545 + next(_LOOPBACK_SEQ)}"

        _LOOPBACK_SERVERS[self._endpoint] = self
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._endpoint is not None:
            _LOOPBACK_SERVERS.pop(self._endpoint, None)
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=2)

    def _handle_rpc(self, payload: dict) -> dict:
        with self._lock:
            self.requests.append(payload)
            req_id = payload.get("id", 1)
            method = payload.get("method", "")
            params = payload.get("params") or []
            arg = params[0] if params and isinstance(params[0], dict) else {}

            if method == "eth_chainId":
                return {"jsonrpc": "2.0", "id": req_id, "result": hex(self.chain_id)}

            if method == "eth_blockNumber":
                return {"jsonrpc": "2.0", "id": req_id, "result": hex(self.block_number)}

            if method == "aetheron_rollbackControl":
                self.rollbacks.append({"op_id": arg.get("op_id"), "control": arg.get("control")})
                return {"jsonrpc": "2.0", "id": req_id, "result": True}

            if method.startswith("aetheron_"):
                control = arg.get("control", "unknown")
                op_id = arg.get("op_id", "op-0")
                tx_hash = "0x" + hashlib.sha256(f"{self.chain_id}:{op_id}:{control}".encode("utf-8")).hexdigest()
                reverted = control in self.revert_controls
                self.transactions[tx_hash] = {
                    "tx_hash": tx_hash,
                    "control": control,
                    "op_id": op_id,
                    "submitted_block": self.block_number,
                    "status": "0x0" if reverted else "0x1",
                    "polls": 0,
                }
                return {"jsonrpc": "2.0", "id": req_id, "result": tx_hash}

            if method == "eth_getTransactionReceipt":
                tx_hash = arg.get("tx_hash") if isinstance(arg, dict) else (params[0] if params else "")
                tx = self.transactions.get(tx_hash)
                if tx is None:
                    return {"jsonrpc": "2.0", "id": req_id, "result": None}
                tx["polls"] += 1
                if tx["polls"] > 1:
                    self.block_number += self.blocks_per_poll
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "transactionHash": tx_hash,
                        "blockNumber": hex(tx["submitted_block"]),
                        "status": tx["status"],
                    },
                }

            return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}
