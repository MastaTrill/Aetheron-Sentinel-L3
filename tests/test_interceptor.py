from aetheron_sentinel.interceptor import LiquidityDrainInterceptor, TransactionSignal


def test_blocks_high_risk_transaction() -> None:
    interceptor = LiquidityDrainInterceptor(block_threshold=70.0)
    signal = TransactionSignal(
        amount_usd=750_000,
        pool_liquidity_usd=2_000_000,
        destination_address_age_days=0.2,
        txs_from_destination_last_24h=0,
        contract_call_depth=7,
        unusual_gas_multiplier=2.3,
    )

    decision = interceptor.evaluate(signal)
    assert decision.block is True
    assert decision.risk_score >= 70.0


def test_allows_low_risk_transaction() -> None:
    interceptor = LiquidityDrainInterceptor(block_threshold=70.0)
    signal = TransactionSignal(
        amount_usd=25_000,
        pool_liquidity_usd=5_000_000,
        destination_address_age_days=120,
        txs_from_destination_last_24h=10,
        contract_call_depth=2,
        unusual_gas_multiplier=1.1,
    )

    decision = interceptor.evaluate(signal)
    assert decision.block is False
    assert decision.risk_score < 70.0


def test_rejects_non_positive_pool_liquidity() -> None:
    interceptor = LiquidityDrainInterceptor()
    signal = TransactionSignal(
        amount_usd=5_000,
        pool_liquidity_usd=0,
        destination_address_age_days=2,
        txs_from_destination_last_24h=2,
        contract_call_depth=2,
        unusual_gas_multiplier=1.0,
    )

    try:
        interceptor.score(signal)
        assert False, "Expected ValueError"
    except ValueError as exc:
        assert "positive" in str(exc)
