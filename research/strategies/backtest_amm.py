"""
Aetheron Sentinel L3 - AMM Backtesting Utility
----------------------------------------------
Simulates the SentinelAMMStrategy against historical or synthetic price data.
"""

import json
import logging
import math
from datetime import datetime
from amm_strategy import SentinelAMMStrategy

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("AMMBacktester")


def calculate_il(price_ratio):
    """Calculates Impermanent Loss for a constant product position."""
    return (2 * math.sqrt(price_ratio) / (1 + price_ratio)) - 1


def run_backtest(strategy, price_series, fee_tier=0.003):
    """
    Iterates through a price series and logs rebalances vs circuit breaker halts.
    """
    events = []
    total_coverage_payout = 0.0
    max_il_observed = 0.0
    total_fees = 0.0
    active_range = None

    logger.info(f"Starting backtest for pool: {strategy.pool_address}")

    for entry in price_series:
        price = entry["price"]
        timestamp = entry["timestamp"]
        volume = entry.get("volume", 0)

        # Fee Calculation: Earn fees if price is within active position range
        if active_range:
            lower, upper = active_range
            if lower <= price <= upper:
                total_fees += volume * fee_tier

        # IL Tracking since last rebalance for insurance simulation
        if strategy.last_rebalance_price:
            ratio = price / strategy.last_rebalance_price
            il = calculate_il(ratio)
            max_il_observed = min(max_il_observed, il)

            # Apply Sentinel Insurance logic: 80% coverage if IL > 5%
            if il <= -0.05:
                total_coverage_payout += abs(il) * 0.80

        action = strategy.analyze_market(price, timestamp=timestamp)

        if action:
            event = {"timestamp": timestamp, "price": price, "result": action}
            events.append(event)

            if action.get("status") == "HALTED":
                logger.warning(
                    f"[{timestamp}] HALTED at ${price} - Reason: {action['reason']}"
                )
            else:
                # Update active range for fee simulation
                active_range = (action["lower_tick_price"], action["upper_tick_price"])
                logger.info(
                    f"[{timestamp}] REBALANCED at ${price} - Range: [{action['lower_tick_price']}, {action['upper_tick_price']}]"
                )

    return {
        "events": events,
        "total_coverage_payout": total_coverage_payout,
        "max_il_observed": max_il_observed,
        "total_fees": total_fees,
    }


if __name__ == "__main__":
    # 1. Synthetic Market Data (Simulating a slow climb, flash crash, and recovery)
    historical_data = [
        {"timestamp": "2026-05-01 12:00", "price": 100.0, "volume": 10000},
        {"timestamp": "2026-05-01 12:05", "price": 102.5, "volume": 12000},
        {"timestamp": "2026-05-01 12:10", "price": 106.0, "volume": 15000},
        {"timestamp": "2026-05-01 12:15", "price": 107.5, "volume": 11000},
        {"timestamp": "2026-05-01 12:20", "price": 85.0, "volume": 50000},
        {"timestamp": "2026-05-01 12:25", "price": 95.0, "volume": 20000},
        {"timestamp": "2026-05-01 12:30", "price": 101.0, "volume": 15000},
        {"timestamp": "2026-05-01 12:35", "price": 112.0, "volume": 18000},
    ]

    # 2. Configure Strategy (Thresholds per DEX_LIQUIDITY.md)
    # Spread: 20%, Rebalance threshold: 5%, Volatility Limit: 15%
    strategy = SentinelAMMStrategy(
        pool_address="0xNexusPool_SENT_ETH", threshold=0.05, volatility_threshold=0.15
    )

    # 3. Run Backtest
    report = run_backtest(strategy, historical_data)
    results = report["events"]

    # 4. Final report summary
    print("\n--- Backtest Summary ---")
    print(f"Total Price Points: {len(historical_data)}")
    print(f"Total Strategy Events Logged: {len(results)}")
    print(f"Max Impermanent Loss Observed: {report['max_il_observed']:.2%}")
    print(f"Total Cumulative Fees Earned: ${report['total_fees']:.2f}")
    print(
        f"Total Simulated Insurance Coverage: {report['total_coverage_payout']:.4f} units"
    )
    print("Check logs above for detailed rebalance vs halt events.")
