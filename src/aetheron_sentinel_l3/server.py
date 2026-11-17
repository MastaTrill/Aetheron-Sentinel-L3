from __future__ import annotations

import json
import threading
import time
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .governance import CryptoAgilityRule, GovernanceRegistry
from .interceptor import LiquidityRiskInput, SentinelInterceptor
from .policy_pack import PolicyPackManager
from .pq_backend import MockDilithiumBackend, RealDilithiumBackend


class SentinelHttpServer:
    """Standalone HTTP REST and JSON-RPC 2.0 server for Aetheron Sentinel L3."""

    def __init__(
        self,
        interceptor: SentinelInterceptor | None = None,
        host: str = "127.0.0.1",
        port: int = 8080,
        chain_id: int = 84532,
    ) -> None:
        self.host = host
        self.port = port
        self.chain_id = chain_id
        self.interceptor = interceptor or self._create_default_interceptor()
        self.anomalies: list[dict] = []
        self.nodes: dict[str, dict] = {}
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @staticmethod
    def _create_default_interceptor() -> SentinelInterceptor:
        try:
            pq = RealDilithiumBackend()
        except ModuleNotFoundError:
            pq = MockDilithiumBackend()
        manager = PolicyPackManager(
            signing_key="sentinel-l3-default-key",
            signature_scheme="hmac-sha256",
            secondary_signature_scheme="pq-ext",
            pq_sign_fn=pq.sign,
            pq_verify_fn=pq.verify,
        )
        pack = manager.sign("v0.2.0-conservative", "prod", {"throttle_threshold": 0.35, "block_threshold": 0.60})
        manager.rollout(pack)
        gov = GovernanceRegistry(alarm_threshold=0.20, critical_alarm_threshold=0.30)
        gov.register_crypto_rule(CryptoAgilityRule(minimum_scheme="pq-ext", grace_days_remaining=0))
        return SentinelInterceptor(
            throttle_threshold=0.35,
            block_threshold=0.60,
            max_hourly_drain_ratio=0.25,
            max_global_hourly_drain_ratio=0.35,
            max_actor_hourly_drain_ratio=0.15,
            policy_pack_manager=manager,
            governance_registry=gov,
        )

    def handle_get(self, path: str) -> tuple[int, dict]:
        if path in {"/health", "/api/sentinel/health"}:
            active_pack = (
                self.interceptor.policy_pack_manager.active.version
                if self.interceptor.policy_pack_manager and self.interceptor.policy_pack_manager.active
                else None
            )
            return 200, {
                "systemHealthy": not self.interceptor.kill_switch_active and len(self.anomalies) == 0,
                "killSwitchActive": self.interceptor.kill_switch_active,
                "activePolicyPack": active_pack,
                "chainId": self.chain_id,
                "timestamp": int(time.time() * 1000),
            }
        if path.startswith("/api/sentinel/nodes/"):
            node_addr = path.rsplit("/", 1)[-1]
            node = self.nodes.get(
                node_addr,
                {
                    "node": node_addr,
                    "status": "ACTIVE",
                    "endpoint": "https://sepolia.base.org",
                    "lastHealthCheck": int(time.time()),
                },
            )
            return 200, node
        return 404, {"error": f"Unknown endpoint: {path}"}

    def handle_post(self, path: str, body: dict) -> tuple[int, dict]:
        if path == "/api/sentinel/evaluate":
            risk_input = LiquidityRiskInput(
                amount=float(body.get("amount", 0.0)),
                available_liquidity=float(body.get("available_liquidity", 50_000.0)),
                velocity_1h=float(body.get("velocity_1h", 0.0)),
                velocity_24h=float(body.get("velocity_24h", 1_000.0)),
                anomaly_score=float(body.get("anomaly_score", 0.0)),
                signer_quorum_ratio=float(body.get("signer_quorum_ratio", 1.0)),
                chain_health_score=float(body.get("chain_health_score", 1.0)),
                oracle_deviation=float(body.get("oracle_deviation", 0.0)),
                counterparty_risk=float(body.get("counterparty_risk", 0.0)),
                bridge_id=str(body.get("bridge_id", "default")),
                chain_id=str(body.get("chain_id", "base-sepolia")),
                asset_symbol=str(body.get("asset_symbol", "AETH")),
                actor_id=str(body.get("actor_id", "unknown-actor")),
                event_id=body.get("event_id"),
            )
            decision = self.interceptor.evaluate(risk_input)
            return 200, asdict(decision)

        if path == "/api/sentinel/anomalies":
            entry = {
                "anomalyHash": body.get("anomalyHash", "0x0"),
                "description": body.get("description", ""),
                "status": "OPEN",
                "reportedAt": int(time.time()),
            }
            self.anomalies.append(entry)
            return 201, entry

        if path == "/api/sentinel/kill-switch":
            active = bool(body.get("active", True))
            if active:
                self.interceptor.engage_kill_switch(str(body.get("reason", "api_kill_switch")))
            else:
                self.interceptor.release_kill_switch()
            return 200, {"killSwitchActive": self.interceptor.kill_switch_active}

        return 404, {"error": f"Unknown endpoint: {path}"}

    def serve_forever(self) -> None:
        parent = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                code, payload = parent.handle_get(self.path)
                self._send_json(code, payload)

            def do_POST(self) -> None:
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
                body = json.loads(raw)
                code, payload = parent.handle_post(self.path, body)
                self._send_json(code, payload)

            def _send_json(self, code: int, payload: dict) -> None:
                raw_resp = json.dumps(payload).encode("utf-8")
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw_resp)))
                self.end_headers()
                self.wfile.write(raw_resp)

            def log_message(self, format: str, *args) -> None:
                return

        self._server = ThreadingHTTPServer((self.host, self.port), Handler)
        self._server.serve_forever()


def main() -> None:
    server = SentinelHttpServer()
    print(f"Starting Aetheron Sentinel L3 HTTP Server on http://{server.host}:{server.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
