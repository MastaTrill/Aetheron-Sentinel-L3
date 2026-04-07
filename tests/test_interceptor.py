import threading
import unittest

from aetheron_sentinel_l3.calibration import AdaptiveCalibrator, ThresholdConfig
from aetheron_sentinel_l3.execution import ActionExecutor, RuleBasedOnChainAdapter
from aetheron_sentinel_l3.governance import CalibrationRecord, CryptoAgilityRule, GovernanceRegistry
from aetheron_sentinel_l3.interceptor import LiquidityRiskInput, SentinelInterceptor
from aetheron_sentinel_l3.policy import PolicyEngine
from aetheron_sentinel_l3.policy_pack import PolicyPackManager
from aetheron_sentinel_l3.simulation import AdversarialSimulator
from aetheron_sentinel_l3.state import InMemoryStateBackend, RedisStateBackend
from aetheron_sentinel_l3.telemetry import InMemoryAuditSink


class FakePipeline:
    def __init__(self, parent):
        self.parent = parent
        self._key = None
        self._amount = 0.0

    def incrbyfloat(self, key, amount):
        self._key = key
        self._amount = amount

    def expire(self, key, ttl):
        _ = (key, ttl)

    def execute(self):
        with self.parent.lock:
            if self.parent.failures_remaining > 0:
                self.parent.failures_remaining -= 1
                raise RuntimeError("partition")
            self.parent.values[self._key] = self.parent.values.get(self._key, 0.0) + self._amount
            return [self.parent.values[self._key], True]


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.events = {}
        self.failures_remaining = 0
        self.lock = threading.Lock()

    def set(self, name, value, ex, nx):
        _ = (value, ex, nx)
        with self.lock:
            if self.failures_remaining > 0:
                self.failures_remaining -= 1
                raise RuntimeError("partition")
            if name in self.events:
                return False
            self.events[name] = True
            return True

    def pipeline(self):
        return FakePipeline(self)


class TestSentinelInterceptor(unittest.TestCase):
    def setUp(self) -> None:
        self.interceptor = SentinelInterceptor()

    def test_policy_pack_runtime_override(self) -> None:
        manager = PolicyPackManager("secret")
        pack = manager.sign("v1", "prod", {"block_threshold": 0.1})
        manager.rollout(pack)
        interceptor = SentinelInterceptor(policy_pack_manager=manager)
        decision = interceptor.evaluate(LiquidityRiskInput(5000, 50_000, 1_500, 9_600, 0.8, 0.9, event_id="p1"))
        self.assertEqual(decision.action, "BLOCK")
        self.assertTrue(any(r.startswith("policy_pack:") for r in decision.reasons))

    def test_governance_auto_rollback(self) -> None:
        manager = PolicyPackManager("secret")
        v1 = manager.sign("v1", "prod", {"block_threshold": 0.7})
        v2 = manager.sign("v2", "prod", {"block_threshold": 0.6})
        manager.rollout(v1)
        manager.rollout(v2)
        gov = GovernanceRegistry(alarm_threshold=0.2)
        interceptor = SentinelInterceptor(policy_pack_manager=manager, governance_registry=gov)
        decision = interceptor.evaluate(
            LiquidityRiskInput(100, 50_000, 200, 9_600, 0.01, 1.0, chain_id="eth", asset_symbol="ETH", event_id="g1")
        )
        self.assertIn("policy_pack_auto_rollback", decision.reasons)
        self.assertEqual(manager.active.version, "v1")

    def test_execution_rollback_verified(self) -> None:
        state = {"paused": False, "capped": False}

        def pause(): state["paused"] = True
        def unpause(): state["paused"] = False
        def cap(): state["capped"] = True
        def uncap(): state["capped"] = False

        adapter = RuleBasedOnChainAdapter(
            apply_map={"pause_bridge": pause, "enable_withdrawal_caps": cap},
            rollback_map={"pause_bridge": unpause, "enable_withdrawal_caps": uncap},
            fail_controls={"enable_withdrawal_caps"},
        )
        result = ActionExecutor(chain_adapter=adapter, failure_budget=0).apply_controls(("pause_bridge", "enable_withdrawal_caps"))
        self.assertFalse(result.verified)
        self.assertIn("pause_bridge", result.rolled_back)
        self.assertFalse(state["paused"])
        self.assertGreaterEqual(len(result.receipts), 1)

    def test_execution_pending_receipt_not_verified(self) -> None:
        adapter = RuleBasedOnChainAdapter(pending_controls={"pause_bridge"})
        result = ActionExecutor(chain_adapter=adapter, failure_budget=1).apply_controls(("pause_bridge",))
        self.assertFalse(result.verified)
        self.assertEqual(result.receipts[0].finalized, False)

    def test_execution_rollback_failure_recorded(self) -> None:
        class RollbackFailAdapter(RuleBasedOnChainAdapter):
            def rollback(self, control: str, op_id: str) -> None:
                raise RuntimeError("rollback failed")

        adapter = RollbackFailAdapter(fail_controls={"enable_withdrawal_caps"})
        result = ActionExecutor(chain_adapter=adapter, failure_budget=0).apply_controls(("pause_bridge", "enable_withdrawal_caps"))
        self.assertIn("rollback:pause_bridge", result.failures)
        self.assertFalse(result.verified)

    def test_redis_backend_retry_and_concurrent_idempotency(self) -> None:
        client = FakeRedis()
        backend = RedisStateBackend(client, max_retries=2)
        client.failures_remaining = 1
        self.assertTrue(backend.register_event("e1", 60))

        results: list[bool] = []

        def worker():
            results.append(backend.register_event("same-event", 60))

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(sum(1 for r in results if r), 1)

    def test_other_components_smoke(self) -> None:
        self.assertEqual(SentinelInterceptor().evaluate(LiquidityRiskInput(50, 50_000, 200, 9600, 0.01, 1.0)).action, "ALLOW")
        gov = GovernanceRegistry(alarm_threshold=0.2)
        gov.record_calibration(CalibrationRecord("eth", "ETH", 0.31, 0.6))
        self.assertEqual(gov.alarms[0].severity, "critical")
        sim = AdversarialSimulator(SentinelInterceptor())
        kpi = sim.tournament([(LiquidityRiskInput(49_000, 50_000, 20_000, 25_000, 0.95, 0.5, event_id="s2"), True, 100.0)])
        self.assertGreaterEqual(kpi.tpr, 1.0)


    def test_post_quantum_policy_pack_and_crypto_agility_enforcement(self) -> None:
        manager = PolicyPackManager(
            "secret",
            signature_scheme="hmac-sha256",
            secondary_signature_scheme="pq-sim-dilithium",
        )
        dual_pack = manager.sign("v-dual", "prod", {"block_threshold": 0.6})
        manager.rollout(dual_pack)

        gov = GovernanceRegistry()
        gov.register_crypto_rule(CryptoAgilityRule(minimum_scheme="pq-sim-dilithium", grace_days_remaining=0))
        interceptor = SentinelInterceptor(policy_pack_manager=manager, governance_registry=gov)
        decision = interceptor.evaluate(LiquidityRiskInput(100, 50_000, 200, 9_600, 0.01, 1.0, event_id="pq-ok"))
        self.assertNotIn("crypto_agility_noncompliant", decision.reasons)

        hmac_manager = PolicyPackManager("secret", signature_scheme="hmac-sha256")
        hmac_pack = hmac_manager.sign("v-hmac", "prod", {"block_threshold": 0.6})
        hmac_manager.rollout(hmac_pack)
        interceptor_bad = SentinelInterceptor(policy_pack_manager=hmac_manager, governance_registry=gov)
        bad_decision = interceptor_bad.evaluate(LiquidityRiskInput(100, 50_000, 200, 9_600, 0.01, 1.0, event_id="pq-bad"))
        self.assertIn("crypto_agility_noncompliant", bad_decision.reasons)

    def test_pq_ext_signature_hook(self) -> None:
        def pq_sign(payload: str) -> str:
            return "ext:" + payload[::-1]

        def pq_verify(payload: str, signature: str) -> bool:
            return signature == "ext:" + payload[::-1]

        manager = PolicyPackManager(
            "secret",
            signature_scheme="pq-ext",
            pq_sign_fn=pq_sign,
            pq_verify_fn=pq_verify,
        )
        pack = manager.sign("v-ext", "prod", {"block_threshold": 0.6})
        manager.rollout(pack)
        self.assertEqual(manager.active.version, "v-ext")

    def test_audit_sink_and_di(self) -> None:
        sink = InMemoryAuditSink()
        interceptor = SentinelInterceptor(
            state_backend=InMemoryStateBackend(),
            calibrator=AdaptiveCalibrator(ThresholdConfig(0.45, 0.7, 0.35, 0.45)),
            policy_engine=PolicyEngine(),
            executor=ActionExecutor(),
            audit_sink=sink,
        )
        interceptor.evaluate(LiquidityRiskInput(200, 50_000, 200, 9_600, 0.05, 1.0, event_id="audit"))
        self.assertEqual(len(sink.events), 1)

    def test_zero_liquidity_does_not_crash(self) -> None:
        decision = self.interceptor.evaluate(
            LiquidityRiskInput(
                amount=10.0,
                available_liquidity=0.0,
                velocity_1h=10.0,
                velocity_24h=100.0,
                anomaly_score=0.2,
                signer_quorum_ratio=1.0,
            )
        )
        self.assertEqual(decision.action, "BLOCK")


if __name__ == "__main__":
    unittest.main()
