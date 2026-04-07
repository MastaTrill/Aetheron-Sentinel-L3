from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TransactionSignal:
    """Signals extracted from a pending bridge transaction."""

    amount_usd: float
    pool_liquidity_usd: float
    destination_address_age_days: float
    txs_from_destination_last_24h: int
    contract_call_depth: int
    unusual_gas_multiplier: float


@dataclass(frozen=True)
class InterceptorDecision:
    block: bool
    risk_score: float
    reason: str


class LiquidityDrainInterceptor:
    """Rule-based model for detecting likely liquidity-drain attempts."""

    def __init__(self, block_threshold: float = 70.0) -> None:
        self.block_threshold = block_threshold

    def score(self, signal: TransactionSignal) -> float:
        if signal.pool_liquidity_usd <= 0:
            raise ValueError("pool_liquidity_usd must be positive")

        withdrawal_ratio = signal.amount_usd / signal.pool_liquidity_usd
        score = 0.0

        # Large extraction relative to pool liquidity is a strong risk indicator.
        score += min(50.0, withdrawal_ratio * 120.0)

        # Newly-created addresses are riskier when extracting large value.
        if signal.destination_address_age_days < 1:
            score += 20.0
        elif signal.destination_address_age_days < 7:
            score += 10.0

        # Deeply nested calls can signal obfuscated exploit paths.
        score += min(15.0, max(0, signal.contract_call_depth - 2) * 4.0)

        # Unexpected gas behavior can indicate front-running or exploit urgency.
        if signal.unusual_gas_multiplier > 2.0:
            score += 10.0
        elif signal.unusual_gas_multiplier > 1.5:
            score += 5.0

        # Fresh address with zero activity and high extraction gets extra weight.
        if signal.txs_from_destination_last_24h == 0 and withdrawal_ratio > 0.25:
            score += 10.0

        return min(100.0, score)

    def evaluate(self, signal: TransactionSignal) -> InterceptorDecision:
        risk_score = self.score(signal)
        block = risk_score >= self.block_threshold
        reason = (
            "Blocked: suspected liquidity-drain pattern"
            if block
            else "Allowed: risk below threshold"
        )
        return InterceptorDecision(block=block, risk_score=risk_score, reason=reason)
