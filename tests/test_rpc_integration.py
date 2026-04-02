import unittest

from aetheron_sentinel_l3.rpc_adapter import (
    JsonRpcAdapterConfig,
    JsonRpcOnChainAdapter,
    RpcResponseError,
    RpcSubmissionError,
    RpcTransportError,
)


class FakeTransport:
    def __init__(self):
        self.calls = []
        self.receipt_calls = 0

    def __call__(self, endpoint: str, payload: dict) -> dict:
        self.calls.append((endpoint, payload))
        method = payload["method"]
        if method.startswith("aetheron_") and method != "aetheron_rollbackControl":
            return {"result": "0xtxhash"}
        if method == "eth_getTransactionReceipt":
            self.receipt_calls += 1
            return {"result": {"confirmations": 2 if self.receipt_calls >= 2 else 0}}
        if method == "aetheron_rollbackControl":
            return {"result": True}
        return {"error": "unknown"}


class TestRpcIntegration(unittest.TestCase):
    def test_invalid_config_raises(self) -> None:
        with self.assertRaises(ValueError):
            JsonRpcOnChainAdapter(JsonRpcAdapterConfig(chain_name="eth", endpoint="http://example", poll_attempts=0))
        with self.assertRaises(ValueError):
            JsonRpcOnChainAdapter(
                JsonRpcAdapterConfig(chain_name="eth", endpoint="http://example", confirmations_required=0)
            )

    def test_apply_and_finalize(self) -> None:
        transport = FakeTransport()
        adapter = JsonRpcOnChainAdapter(
            JsonRpcAdapterConfig(chain_name="eth-sepolia", endpoint="http://example", confirmations_required=2, poll_attempts=3),
            transport=transport,
        )
        receipt = adapter.apply("pause_bridge", "op-1")
        self.assertTrue(receipt.finalized)
        self.assertTrue(adapter.verify(receipt))

    def test_rollback(self) -> None:
        transport = FakeTransport()
        adapter = JsonRpcOnChainAdapter(JsonRpcAdapterConfig(chain_name="eth-sepolia", endpoint="http://example"), transport=transport)
        adapter.rollback("pause_bridge", "op-2")
        self.assertTrue(any(call[1]["method"] == "aetheron_rollbackControl" for call in transport.calls))

    def test_failed_transaction_is_not_finalized(self) -> None:
        def failed_transport(_endpoint: str, payload: dict) -> dict:
            if payload["method"].startswith("aetheron_") and payload["method"] != "aetheron_rollbackControl":
                return {"result": "0xtxhash"}
            if payload["method"] == "eth_getTransactionReceipt":
                return {"result": {"status": "0x0", "confirmations": 100}}
            return {"result": True}

        adapter = JsonRpcOnChainAdapter(JsonRpcAdapterConfig(chain_name="eth-sepolia", endpoint="http://example"), transport=failed_transport)
        receipt = adapter.apply("pause_bridge", "op-3")
        self.assertFalse(receipt.finalized)
        self.assertFalse(adapter.verify(receipt))

    def test_invalid_submit_hash_raises(self) -> None:
        def invalid_submit_transport(_endpoint: str, payload: dict) -> dict:
            if payload["method"].startswith("aetheron_"):
                return {"result": ""}
            return {"result": {"confirmations": 3}}

        adapter = JsonRpcOnChainAdapter(
            JsonRpcAdapterConfig(chain_name="eth-sepolia", endpoint="http://example"),
            transport=invalid_submit_transport,
        )
        with self.assertRaises(RpcSubmissionError):
            adapter.apply("pause_bridge", "op-4")

    def test_transport_exception_wrapped(self) -> None:
        def exploding_transport(_endpoint: str, _payload: dict) -> dict:
            raise TimeoutError("network timeout")

        adapter = JsonRpcOnChainAdapter(
            JsonRpcAdapterConfig(chain_name="eth-sepolia", endpoint="http://example"),
            transport=exploding_transport,
        )
        with self.assertRaises(RpcTransportError):
            adapter.apply("pause_bridge", "op-5")

    def test_non_dict_response_raises(self) -> None:
        def invalid_response_transport(_endpoint: str, _payload: dict):
            return "not-json-object"

        adapter = JsonRpcOnChainAdapter(
            JsonRpcAdapterConfig(chain_name="eth-sepolia", endpoint="http://example"),
            transport=invalid_response_transport,
        )
        with self.assertRaises(RpcResponseError):
            adapter.apply("pause_bridge", "op-6")


if __name__ == "__main__":
    unittest.main()
