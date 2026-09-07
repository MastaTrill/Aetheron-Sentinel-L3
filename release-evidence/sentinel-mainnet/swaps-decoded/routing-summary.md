# SENTINEL V4 decoded swap and routing evidence

- Captured: 2026-07-26T21:43:02.122Z
- Direction correction: 2026-09-07
- Chain ID: 8453
- Pool manager: `0x498581fF718922c3f8e6A244956aF099B2652b2b`
- Pool ID: `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`
- Block range: 42506026–49143598
- Matching swaps: 54
- Buys (WETH in, SENTINEL out): 52
- Sells (SENTINEL in, WETH out): 2
- Other sign patterns: 0
- Unique event senders: 3

## Direction correction

The original decoder projection inverted the human-readable buy/sell labels while preserving the transaction hashes, entrypoints, and swap-event rows. The corrected convention is:

- **buy-sentinel-with-weth**: WETH enters the PoolManager and SENTINEL leaves it.
- **sell-sentinel-for-weth**: SENTINEL enters the PoolManager and WETH leaves it.

This was independently checked against the first round-trip smoke test:

- `0x090e6f6c9e96f947ecb83b17e1c5146749e1034aa78685b1b28bf6d7d5fa0e16` sent `0.01 ETH` into the router and moved the PoolManager tick from `230000` to `229980`, so it is a **buy**.
- `0x78523d00b46679e31b7453b0ddfcd639cb1bea583c5a0da5a423588ee6d1821f` returned SENTINEL and moved the tick from `229980` to `229999`, so it is a **sell**.

The original artifact digests remain recorded in `PROVENANCE.json`; this committed projection corrects only the inverted direction labels and derived counts.

## Transaction entrypoints

- `0x0000000000001fF3684f28c67538d4D072C22734`
- `0x1C133F088ba344b8cf51549312BeD524DDcD7393`
- `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`

## Evidence limitations

This file proves historical successful PoolManager Swap events for the canonical pool and records the outer transaction entrypoints and selectors. It does not identify the human trader, prove current quote availability, or replace a fresh buy-and-sell smoke test.
