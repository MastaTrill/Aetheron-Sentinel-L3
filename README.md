# Aetheron-Sentinel-L3

Features an **Autonomous Interceptor** prototype that blocks transaction patterns commonly associated with liquidity-drain attacks on bridges.

## What is included

- A rule-based `LiquidityDrainInterceptor` scoring engine.
- A small CLI for evaluating candidate transactions.
- Basic unit tests that cover high/low risk flows and input validation.

## Quick start

```bash
python -m pip install -e .
python -m aetheron_sentinel.cli \
  --amount-usd 750000 \
  --pool-liquidity-usd 2000000 \
  --destination-address-age-days 0.2 \
  --txs-from-destination-last-24h 0 \
  --contract-call-depth 7 \
  --unusual-gas-multiplier 2.3
```

Example output:

```json
{
  "block": true,
  "risk_score": 87.0,
  "reason": "Blocked: suspected liquidity-drain pattern"
}
```

## Run tests

```bash
python -m pytest
```
