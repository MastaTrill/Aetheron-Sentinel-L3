# SENTINEL liquidity execution preflight — 2026-09-07

**Status:** PRE-BROADCAST / FUNDING BLOCKED

This package turns the post-launch liquidity plan into concrete current-chain parameters while preserving all existing SENTINEL/Airlock/beneficiary/migration state. Nothing in this document authorizes or broadcasts a transaction.

## Immutable addresses

- Chain: Base Mainnet (`8453`)
- SENTINEL: `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`
- WETH: `0x4200000000000000000000000000000000000006`
- Existing v4 PoolManager: `0x498581fF718922c3f8e6A244956aF099B2652b2b`
- Existing Doppler pool ID: `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`
- Doppler hook: `0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0`
- Airlock: `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12`
- Uniswap v4 Quoter: `0x0d5e0f971ed27fbff6c2837bf31316121532048d`
- Uniswap v3 Factory: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`
- Uniswap v3 NonfungiblePositionManager: `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`

## Fresh Doppler state

Read immediately before this package was prepared:

- PoolManager tick: `229999`
- LP fee: `12000` (`1.20%`)
- Main position upper tick: `230000`

The launch pool remains pinned one tick below the upper edge.

## Fresh acquisition quote

Read-only v4 `quoteExactInputSingle` using the exact live PoolKey:

- Input: `0.473065 WETH`
- Input wei: `473065000000000000`
- Quoted output: `4,350,000,280.800932069356608962 SENTINEL`
- Quoter gas estimate: `51,510`
- Recommended execution-time drift guard: `0.50%`
- Minimum output at that guard: `4,328,250,279.396927409009825917 SENTINEL`

The quote was produced from the canonical WETH/SENTINEL Doppler v4 pool with `fee=0x800000`, `tickSpacing=200`, `zeroForOne=true`, and empty hook data.

At the contemporaneous Base WETH reference of approximately `$2,491.12`, the quoted WETH input is about `$1,178.46` before gas.

### Execution rule

Do **not** reuse this quote after material state change. Re-quote immediately before signing. Abort if:

- pool/address/chain checks differ;
- tick or fee changes materially;
- the live quote falls below the approved economic threshold;
- decoded transaction calldata contains any Airlock, beneficiary, migration, ownership, mint, or existing-position write.

## Modeled post-acquisition state

Using the live active-liquidity state and the fresh v4 output, the acquisition should move the Doppler price materially away from the sell-starved edge:

- Modeled post-buy tick: approximately `229104`
- Modeled post-buy spot: approximately `8.899751452B SENTINEL / WETH`
- This is approximately a 9.36% increase in SENTINEL's WETH-denominated marginal price relative to the pre-buy state.

These are planning values only. The confirmed post-buy `sqrtPriceX96`, tick and fee MUST be read from PoolManager after the acquisition and before companion-pool initialization.

## Companion Uniswap v3 market — $1,000 two-way target

Factory lookup confirms there is currently **no** standard SENTINEL/WETH Uniswap v3 pool at the intended `0.30%` (`3000`) tier.

Post-buy planning range:

- Fee tier: `3000` (`0.30%`)
- Tick spacing: `60`
- Planned lower tick: `228540`
- Planned upper tick: `229680`
- Approximate price envelope relative to modeled post-buy anchor: `-5.49% / +5.93%` in SENTINEL-per-WETH terms

For a roughly `$1,000` two-way trade target with about 5% modeled endpoint price movement, the current planning seed is:

- `0.459796 WETH` (approximately)
- `4.012817403B SENTINEL` (approximately)

The acquisition quote leaves roughly `337.18M SENTINEL` beyond this modeled v3 seed requirement, providing an execution buffer.

The exact v3 `sqrtPriceX96`, ticks and mint amounts MUST be recomputed from the **confirmed post-acquisition Doppler state**, not hard-coded from this preflight estimate.

## Total external WETH requirement

The $1,000-depth plan requires external WETH/ETH for **both** stages:

1. Doppler acquisition: `0.473065 WETH`
2. Companion v3 WETH side: approximately `0.459796 WETH`

Total planning requirement: approximately **`0.932861 WETH` plus gas** (about `$2,323.87` at the contemporaneous WETH reference).

This is the correct capital requirement; the acquisition amount alone is not enough to both acquire the SENTINEL side and fund the WETH side of the companion LP.

## Funding-wallet check

Known project/deployment addresses checked on Base at preparation time:

- `0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2`: `0 ETH`
- `0x8A3ad49656Bd07981C9CFc7aD826a808847c3452`: `0 ETH`
- `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`: `0 ETH`
- `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` (treasury): approximately `0.000001758 ETH`
- `0xF941b28F3b4188C473a4C8c78845EBAb58654BA6`: `0 ETH`
- `0x7e3D11f70084D667295710E6b7FF50C3b0487a45` (legacy creator): effectively `0 ETH`

The historical smoke-test origin `0x9edd54b54ced8385729cb34452fa3216bf8027df` currently has approximately `0.3262318934 ETH`, no WETH, and no SENTINEL. Repository evidence does not establish that address as the approved liquidity-funding signer.

Even if it were approved, it is short by roughly **`0.60663 ETH/WETH` plus gas** versus the full `$1,000`-depth plan.

## Current execution gate

**BLOCKED: no verified/approved funding signer with approximately `0.933 WETH/ETH + gas` has been identified.**

No mainnet transaction should be constructed for signature until the funding signer and LP-NFT custody recipient are explicitly resolved and their balances/control are verified.

Preferred custody design, subject to control verification: mint the standard v3 LP NFT to the documented Aetheron treasury `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`, while allowing a separately approved funded signer to supply the assets. This does not alter Doppler/Airlock beneficiary shares.

## After funding is resolved

The next deterministic sequence is:

1. Fresh read of PoolManager slot0 and fee.
2. Fresh v4 exact-input quote.
3. Generate and decode exact swap calldata with a hard amount-in and minimum-out.
4. Simulate the exact transaction from the funded signer; require success and expected asset deltas.
5. Sign/broadcast acquisition.
6. Wait for receipt; record block/hash/output.
7. Read confirmed post-buy Doppler state and fresh two-way quotes.
8. Recompute v3 initialization price, valid ticks, liquidity and token amounts.
9. Generate/decode/simulate the v3 create+initialize+mint transaction.
10. Mint LP NFT to the approved custody recipient.
11. Run `$100` and `$1,000` two-way quote/smoke-test acceptance checks.
12. Verify Airlock, beneficiaries, Doppler positions and migration state are unchanged.
