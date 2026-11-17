import importlib.util
import unittest
from unittest.mock import patch

from aetheron_sentinel_l3.governance import CryptoAgilityRule, GovernanceRegistry
from aetheron_sentinel_l3.interceptor import LiquidityRiskInput, SentinelInterceptor
from aetheron_sentinel_l3.policy_pack import PolicyPackManager
from aetheron_sentinel_l3.pq_backend import MockDilithiumBackend, RealDilithiumBackend


class TestPQBackend(unittest.TestCase):
    def test_mock_backend_roundtrip(self) -> None:
        backend = MockDilithiumBackend()
        payload = "bridge:pause"
        signature = backend.sign(payload)

        self.assertTrue(signature.startswith("pqext:"))
        self.assertTrue(backend.verify(payload, signature))
        self.assertFalse(backend.verify("bridge:resume", signature))

    def test_real_backend_requires_optional_dependency(self) -> None:
        with patch("importlib.util.find_spec", return_value=None):
            with self.assertRaises(ModuleNotFoundError) as ctx:
                RealDilithiumBackend()

        self.assertIn("dilithium_py", str(ctx.exception))

    @unittest.skipIf(importlib.util.find_spec("dilithium_py") is None, "dilithium_py not installed")
    def test_real_dilithium_backend_sign_verify_and_dual_sign_drill(self) -> None:
        seed = bytes([42] * 48)
        backend = RealDilithiumBackend(seed=seed)
        payload = "aetheron:sentinel:l3:policy-v1"
        sig = backend.sign(payload)
        self.assertTrue(backend.verify(payload, sig))
        self.assertFalse(backend.verify(payload + ":tampered", sig))
        self.assertFalse(backend.verify(payload, "deadbeef"))

        manager = PolicyPackManager(
            signing_key="staging-hmac-secret",
            signature_scheme="hmac-sha256",
            secondary_signature_scheme="pq-ext",
            pq_sign_fn=backend.sign,
            pq_verify_fn=backend.verify,
        )
        v1 = manager.sign("v1.0", "prod", {"throttle_threshold": 0.45, "block_threshold": 0.70})
        v2 = manager.sign("v2.0", "prod", {"throttle_threshold": 0.35, "block_threshold": 0.55})
        manager.rollout(v1)
        manager.rollout(v2)
        self.assertEqual(manager.active.version, "v2.0")

        gov = GovernanceRegistry(alarm_threshold=0.2, critical_alarm_threshold=0.3)
        gov.register_crypto_rule(CryptoAgilityRule(minimum_scheme="pq-ext", grace_days_remaining=0))
        interceptor = SentinelInterceptor(policy_pack_manager=manager, governance_registry=gov)

        decision = interceptor.evaluate(
            LiquidityRiskInput(
                amount=50.0,
                available_liquidity=50_000.0,
                velocity_1h=100.0,
                velocity_24h=9_600.0,
                anomaly_score=0.01,
                signer_quorum_ratio=1.0,
                event_id="staging-pq-drill-1",
            )
        )
        self.assertNotIn("crypto_agility_noncompliant", decision.reasons)
        self.assertIn("policy_pack_auto_rollback", decision.reasons)
        self.assertEqual(manager.active.version, "v1.0")


if __name__ == "__main__":
    unittest.main()
