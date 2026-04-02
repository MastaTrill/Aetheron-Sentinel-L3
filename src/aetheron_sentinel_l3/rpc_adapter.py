from __future__ import annotations

import json
import time
import urllib.request
from dataclasses import dataclass
from itertools import count
from typing import Callable

from .execution import OnChainAdapter, OperationReceipt


@dataclass
class JsonRpcAdapterConfig:
    chain_name: str
    endpoint: str
    confirmations_required: int = 1
    poll_attempts: int = 3
    poll_interval_seconds: float = 0.0


class JsonRpcAdapterError(RuntimeError):
    """Base class for JSON-RPC adapter failures."""


class RpcTransportError(JsonRpcAdapterError):
    """Raised when the HTTP/transport layer fails."""


class RpcSubmissionError(JsonRpcAdapterError):
    """Raised when control submission does not return a valid tx hash."""


class RpcResponseError(JsonRpcAdapterError):
    """Raised for explicit JSON-RPC error payloads."""


class JsonRpcOnChainAdapter(OnChainAdapter):
    """JSON-RPC execution adapter with pluggable transport and receipt polling."""

    def __init__(self, config: JsonRpcAdapterConfig, transport: Callable[[str, dict], dict] | None = None) -> None:
        if config.confirmations_required < 1:
            raise ValueError("confirmations_required must be >= 1")
        if config.poll_attempts < 1:
            raise ValueError("poll_attempts must be >= 1")
        if config.poll_interval_seconds < 0:
            raise ValueError("poll_interval_seconds must be >= 0")
        self.config = config
        self._transport = transport or self._default_transport
        self._finalized: dict[str, bool] = {}
        self._request_ids = count(1)

    def apply(self, control: str, op_id: str) -> OperationReceipt:
        submit_method = self._control_method(control)
        tx_hash = self._rpc(submit_method, {"op_id": op_id, "control": control})
        if not isinstance(tx_hash, str) or not tx_hash:
            raise RpcSubmissionError("rpc submit returned invalid transaction hash")
        finalized = self._wait_for_finality(tx_hash)
        self._finalized[tx_hash] = finalized
        return OperationReceipt(op_id=op_id, control=control, status="submitted", tx_hash=tx_hash, finalized=finalized)

    def rollback(self, control: str, op_id: str) -> None:
        _ = self._rpc("aetheron_rollbackControl", {"op_id": op_id, "control": control})

    def verify(self, receipt: OperationReceipt) -> bool:
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
            confirmations = self._parse_confirmations(receipt)
            if confirmations >= self.config.confirmations_required:
                return True
            if self.config.poll_interval_seconds > 0 and attempt < self.config.poll_attempts - 1:
                time.sleep(self.config.poll_interval_seconds)
        return False

    def _control_method(self, control: str) -> str:
        return {
            "pause_bridge": "aetheron_pauseBridge",
            "enable_withdrawal_caps": "aetheron_setWithdrawalCaps",
            "add_time_delay": "aetheron_setDelay",
        }.get(control, "aetheron_applyControl")

    def _rpc(self, method: str, params: dict):
        try:
            response = self._transport(
                self.config.endpoint,
                {"jsonrpc": "2.0", "id": next(self._request_ids), "method": method, "params": [params]},
            )
        except Exception as exc:
            raise RpcTransportError(f"transport failure for method {method}") from exc
        if not isinstance(response, dict):
            raise RpcResponseError(f"rpc response is not an object for method {method}")
        if "error" in response:
            raise RpcResponseError(f"rpc error: {response['error']}")
        return response.get("result")

    @staticmethod
    def _parse_confirmations(receipt: dict) -> int:
        value = receipt.get("confirmations", 0)
        try:
            if isinstance(value, str):
                if value.startswith("0x"):
                    return int(value, 16)
                return int(value)
            if isinstance(value, int):
                return value
        except ValueError:
            return 0
        return 0

    @staticmethod
    def _default_transport(endpoint: str, payload: dict) -> dict:
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
