from __future__ import annotations

import argparse
import json

from .interceptor import LiquidityDrainInterceptor, TransactionSignal


def main() -> None:
    parser = argparse.ArgumentParser(description="Aetheron Sentinel L3 demo")
    parser.add_argument("--amount-usd", type=float, required=True)
    parser.add_argument("--pool-liquidity-usd", type=float, required=True)
    parser.add_argument("--destination-address-age-days", type=float, required=True)
    parser.add_argument("--txs-from-destination-last-24h", type=int, required=True)
    parser.add_argument("--contract-call-depth", type=int, required=True)
    parser.add_argument("--unusual-gas-multiplier", type=float, required=True)
    parser.add_argument("--block-threshold", type=float, default=70.0)
    args = parser.parse_args()

    signal = TransactionSignal(
        amount_usd=args.amount_usd,
        pool_liquidity_usd=args.pool_liquidity_usd,
        destination_address_age_days=args.destination_address_age_days,
        txs_from_destination_last_24h=args.txs_from_destination_last_24h,
        contract_call_depth=args.contract_call_depth,
        unusual_gas_multiplier=args.unusual_gas_multiplier,
    )

    interceptor = LiquidityDrainInterceptor(block_threshold=args.block_threshold)
    decision = interceptor.evaluate(signal)

    print(
        json.dumps(
            {
                "block": decision.block,
                "risk_score": round(decision.risk_score, 2),
                "reason": decision.reason,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
