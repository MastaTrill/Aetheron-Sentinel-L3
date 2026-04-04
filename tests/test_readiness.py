import random
import unittest

from aetheron_sentinel_l3.execution import ActionExecutor
from aetheron_sentinel_l3.pq_backend import MockDilithiumBackend
from aetheron_sentinel_l3.policy_pack import PolicyPackManager
from aetheron_sentinel_l3.rpc_adapter import JsonRpcAdapterConfig, JsonRpcOnChainAdapter
from aetheron_sentinel_l3.state import InMemoryStateBackend


class TestReadiness(unittest.TestCase):
    def test_rpc_adapter_receipt_verification(self) -> None:
        def transport(_endpoint: str, payload: dict) -> dict:
            if payload["method"].startswith("aetheron_"):
                return {"result": "eth-sepolia:op-1:pause_bridge"}
            if payload["method"] == "eth_getTransactionReceipt":
                return {"result": {"confirmations": 2}}
            return {"result": True}

        adapter = JsonRpcOnChainAdapter(
            JsonRpcAdapterConfig(chain_name="eth-sepolia", endpoint="https://example.invalid", confirmations_required=1),
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


if __name__ == "__main__":
    unittest.main()
