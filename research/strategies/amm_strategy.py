"""
Aetheron Sentinel L3 - Post-Launch AMM Strategy
-----------------------------------------------
Automated liquidity management for $SENT concentrated liquidity pools.
"""

import logging
import json
from datetime import datetime, timedelta


class SentinelAMMStrategy:
    def __init__(
        self,
        pool_address,
        spread=0.20,
        threshold=0.05,
        volatility_threshold=0.15,
        rebalance_cooldown_minutes=60,
    ):
        self.pool_address = pool_address
        self.base_spread = spread  # ±20% per DEX_LIQUIDITY.md
        self.spread = spread
        self.threshold = threshold  # Rebalance if price drifts >5%
        self.volatility_threshold = (
            volatility_threshold  # Circuit breaker threshold (15%)
        )
        self.rebalance_cooldown = timedelta(minutes=rebalance_cooldown_minutes)
        self.last_rebalance_price = None
        self.last_rebalance_time = None
        self.logger = logging.getLogger("SentinelAMMStrategy")

    def analyze_market(self, current_price, timestamp=None):
        """
        Analyzes the market state and returns rebalancing parameters if needed.
        """
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)

        if self.last_rebalance_price is None:
            return self._generate_params(current_price, timestamp)

        # 1. Cooldown Check
        if self.last_rebalance_time and timestamp:
            if timestamp - self.last_rebalance_time < self.rebalance_cooldown:
                # Too soon to rebalance
                return None

        drift = (
            abs(current_price - self.last_rebalance_price) / self.last_rebalance_price
        )

        # Dynamic spread adjustment based on market volatility
        self._adjust_spread_for_volatility(drift)

        # Circuit Breaker Check: Stop rebalancing during extreme volatility
        if drift >= self.volatility_threshold:
            self.logger.warning(
                f"CIRCUIT BREAKER ACTIVE: Drift {drift:.2%} exceeds limit {self.volatility_threshold:.2%}. Halting."
            )
            return {"status": "HALTED", "reason": "Extreme Volatility", "drift": drift}

        if drift >= self.threshold:
            self.logger.info(
                f"Rebalance triggered: Drift {drift:.2%} exceeds threshold {self.threshold:.2%}"
            )
            return self._generate_params(current_price, timestamp)

        return None

    def _adjust_spread_for_volatility(self, drift):
        """Dynamically adjusts spread based on market drift (proxy for volatility)."""
        # Widens spread proportionally to drift, capped between 5% and 50%
        volatility_adjustment = drift * 1.5
        self.spread = self.base_spread * (1 + volatility_adjustment)
        self.spread = max(0.05, min(0.50, self.spread))
        self.logger.debug(f"Dynamic Spread Adjusted: {self.spread:.2%}")

    def _generate_params(self, price, timestamp):
        lower = price * (1 - self.spread)
        upper = price * (1 + self.spread)
        self.last_rebalance_price = price
        self.last_rebalance_time = timestamp

        return {
            "pool": self.pool_address,
            "lower_tick_price": round(lower, 8),
            "upper_tick_price": round(upper, 8),
            "target_price": round(price, 8),
            "timestamp": datetime.utcnow().isoformat(),
        }


if __name__ == "__main__":
    # Example Usage
    strategy = SentinelAMMStrategy("0x...PoolAddress")
    print("Initial Positioning:", strategy.analyze_market(100.0))
    print("Small Price Move (98.0):", strategy.analyze_market(98.0))
    print("Major Price Move (94.0):", strategy.analyze_market(94.0))
