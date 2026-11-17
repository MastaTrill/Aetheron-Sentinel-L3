import random
import unittest

from aetheron_sentinel_l3.execution import ActionExecutor
from aetheron_sentinel_l3.policy_pack import PolicyPackManager
from aetheron_sentinel_l3.pq_backend import MockDilithiumBackend
from aetheron_sentinel_l3.rpc_adapter import JsonRpcAdapterConfig, JsonRpcOnChainAdapter
from aetheron_sentinel_l3.server import SentinelHttpServer
from aetheron_sentinel_l3.staging import StagingWindowRunner
from aetheron_sentinel_l3.state import InMemoryStateBackend, RedisStateBackend


class PartitionFakePipeline:
    def __init__(self, parent: "PartitionFakeRedis") -> None:
        self.parent = parent
        self._key: str | None = None
        self._amount: float = 0.0

    def incrbyfloat(self, key: str, amount: float) -> None:
        self._key = key
        self._amount = amount

    def expire(self, key: str, ttl: int) -> None:
        _ = (key, ttl)

    def execute(self) -> list:
        if self.parent.failures_remaining > 0:
            self.parent.failures_remaining -= 1
            raise RuntimeError("redis network partition")
        assert self._key is not None
        self.parent.values[self._key] = self.parent.values.get(self._key, 0.0) + self._amount
        return [self.parent.values[self._key], True]


class PartitionFakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, float] = {}
        self.events: dict[str, bool] = {}
        self.failures_remaining = 0

    def set(self, name: str, value: str, ex: int, nx: bool) -> bool:
        _ = (value, ex, nx)
        if self.failures_remaining > 0:
            self.failures_remaining -= 1
            raise RuntimeError("redis network partition")
        if name in self.events:
            return False
        self.events[name] = True
        return True

    def pipeline(self) -> PartitionFakePipeline:
        return PartitionFakePipeline(self)


class TestReadiness(unittest.TestCase):
    def test_rpc_adapter_receipt_verification(self) -> None:
        def transport(_endpoint: str, payload: dict) -> dict:
            if payload["method"].startswith("aetheron_"):
                return {"result": "eth-sepolia:op-1:pause_bridge"}
            if payload["method"] == "eth_getTransactionReceipt":
                return {"result": {"confirmations": 2}}
            return {"result": True}

        adapter = JsonRpcOnChainAdapter(
            JsonRpcAdapterConfig(
                chain_name="eth-sepolia",
                endpoint="https://example.invalid",
                confirmations_required=1,
            ),
            transport=transport,
        )
        executor = ActionExecutor(chain_adapter=adapter)
        result = executor.apply_controls(("pause_bridge",))
        self.assertTrue(result.verified)
        self.assertTrue(result.receipts[0].tx_hash.startswith("eth-sepolia:"))

    def test_pq_backend_with_policy_manager(self) -> None:
        backend = MockDilithiumBackend()
        manager = PolicyPackManager(
            "secret",
            signature_scheme="pq-ext",
            pq_sign_fn=backend.sign,
            pq_verify_fn=backend.verify,
        )
        pack = manager.sign("v1", "prod", {"block_threshold": 0.6})
        manager.rollout(pack)
        self.assertEqual(manager.active.version, "v1")

    def test_idempotency_flood_resilience(self) -> None:
        backend = InMemoryStateBackend()
        accepted = 0
        for _ in range(500):
            if backend.register_event("same-event", 60):
                accepted += 1
        self.assertEqual(accepted, 1)

    def test_counter_stress(self) -> None:
        backend = InMemoryStateBackend()
        total = 0.0
        for _ in range(1000):
            amt = random.random()
            total += amt
            val = backend.increment_counter("k", amt, 60)
        self.assertAlmostEqual(val, total, places=6)

    def test_redis_partition_simulation_and_recovery(self) -> None:
        client = PartitionFakeRedis()
        backend = RedisStateBackend(client, max_retries=2)

        client.failures_remaining = 4
        with self.assertRaises(RuntimeError):
            backend.register_event("evt-partition", 60)

        self.assertTrue(backend.register_event("evt-partition", 60))
        self.assertFalse(backend.register_event("evt-partition", 60))

        client.failures_remaining = 2
        val = backend.increment_counter("bridge:base:outflow", 1500.0, 60)
        self.assertEqual(val, 1500.0)

    def test_two_clean_staging_windows_end_to_end(self) -> None:
        runner = StagingWindowRunner(prefer_real_pq=True)
        w1, w2 = runner.run_two_clean_staging_windows()
        self.assertTrue(w1.passed)
        self.assertTrue(w2.passed)
        self.assertTrue(w1.rpc_finality_verified)
        self.assertTrue(w1.rpc_compensating_rollback_verified)
        self.assertTrue(w1.dual_sign_rollout_verified)
        self.assertTrue(w1.dual_sign_auto_rollback_verified)
        self.assertEqual(w1.idempotency_flood_blocked, 199)
        self.assertTrue(w1.redis_partition_recovered)
        self.assertTrue(w1.kill_switch_drill_verified)
        self.assertTrue(w1.execution_failure_alert_verified)
        self.assertEqual(w1.tournament_kpi.tpr, 1.0)
        self.assertEqual(w1.tournament_kpi.fpr, 0.0)

    def test_sentinel_http_server_handlers(self) -> None:
        srv = SentinelHttpServer()
        code, health = srv.handle_get("/api/sentinel/health")
        self.assertEqual(code, 200)
        self.assertTrue(health["systemHealthy"])

        code, eval_ok = srv.handle_post(
            "/api/sentinel/evaluate",
            {"amount": 100.0, "available_liquidity": 50_000.0, "velocity_1h": 200.0, "velocity_24h": 9_600.0},
        )
        self.assertEqual(code, 200)
        self.assertEqual(eval_ok["action"], "ALLOW")

        srv.handle_post("/api/sentinel/kill-switch", {"active": True, "reason": "drill"})
        code, eval_blocked = srv.handle_post("/api/sentinel/evaluate", {"amount": 10.0})
        self.assertEqual(code, 200)
        self.assertEqual(eval_blocked["action"], "BLOCK")


if __name__ == "__main__":
    unittest.main()
