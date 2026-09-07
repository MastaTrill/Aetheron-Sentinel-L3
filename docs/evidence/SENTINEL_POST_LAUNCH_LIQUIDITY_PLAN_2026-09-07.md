# SENTINEL post-launch two-way liquidity plan — 2026-09-07

**Status:** PREPARED / NO BROADCAST

This runbook restores practical two-way SENTINEL/WETH depth without mutating the existing Doppler/Airlock launch state. It deliberately separates the launch/auction market from a future standard post-launch trading market.

## Immutable existing-state constraints

The following are invariants for this plan and MUST NOT be changed by execution:

- SENTINEL token: `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`
- Base chain ID: `8453`
- Existing Uniswap v4 PoolManager: `0x498581fF718922c3f8e6A244956aF099B2652b2b`
- Existing Doppler pool ID: `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`
- Existing Airlock: `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12`
- Existing beneficiary addresses and shares remain byte-for-byte unchanged.
- Existing Doppler positions, hook, initializer, fee accounting, migration state, and Airlock ownership remain unchanged.
- No `addLiquidity` attempt is made against the Doppler pool because its hook controls launch liquidity.

Live read at preparation time:

- PoolManager tick: `229999`
- Terminal LP fee: `12000` = `1.20%`
- Main launch position upper tick: `230000`

This confirms the auction remains pinned one tick below its upper boundary.

## Phase 1 — correct swap evidence

The historical 54-row projection used the correct transactions but inverted the human-readable buy/sell labels. The corrected convention is now:

- `buy-sentinel-with-weth` = WETH enters PoolManager and SENTINEL leaves.
- `sell-sentinel-for-weth` = SENTINEL enters PoolManager and WETH leaves.

Corrected aggregate: **52 buys / 2 sells**.

The source artifact hashes are preserved in `release-evidence/sentinel-mainnet/swaps-decoded/PROVENANCE.json` so the correction remains auditable.

## Phase 2 — rebalance the existing Doppler auction by acquiring SENTINEL

Initial target: enough circulating SENTINEL to seed a roughly **$1,000 two-way-depth** standard post-launch market.

Model target before final execution-time requote:

- Acquire approximately `4.35B SENTINEL` from the existing Doppler pool.
- Prior model required approximately `0.473 WETH` to acquire that amount; this is NOT a fixed execution amount.
- A fresh exact-input/exact-output quote MUST be obtained immediately before any signed transaction.

The purchase serves two purposes simultaneously:

1. It moves SENTINEL from launch liquidity into a circulating wallet for the companion LP.
2. It leaves real WETH inside the Doppler auction, moving the pool away from the sell-starved `229999` edge.

### Mandatory preflight before signing

Execution MUST abort unless all are true:

1. Chain ID is exactly `8453`.
2. SENTINEL address matches the canonical address above.
3. Pool ID, PoolManager, hook and Airlock match committed evidence.
4. Current PoolManager tick is read fresh.
5. Both buy and small sell quotes succeed through the actual v4 hook.
6. The acquisition quote returns enough SENTINEL for the companion LP within the explicitly approved WETH budget and slippage limit.
7. No beneficiary, Airlock, migrator, hook or launch-position write is included in the transaction.
8. Transaction calldata is decoded and reviewed before wallet signature.

## Phase 3 — snapshot the new auction price after the acquisition

Immediately after the acquisition confirms:

- Record transaction hash and block.
- Read Doppler `slot0` again.
- Record post-buy `sqrtPriceX96`, tick and fee.
- Quote both directions again.
- Measure the new maximum executable SENTINEL->WETH amount.
- Use this post-buy price, not the pre-buy price, as the anchor for the companion market.

This prevents immediate arbitrage caused by initializing the standard pool at a stale price.

## Phase 4 — create a separate standard Uniswap v3 SENTINEL/WETH pool

The companion market is independent of the Doppler hook and does not modify the original Airlock or beneficiary structure.

Canonical Base Uniswap v3 contracts verified against Uniswap deployment documentation on 2026-09-07:

- Factory: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`
- NonfungiblePositionManager: `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`
- QuoterV2: `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`
- SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481`
- WETH: `0x4200000000000000000000000000000000000006`

Initial design target:

- Fee tier: `0.30%` (`3000`)
- Tick spacing: `60`
- Price anchor: fresh post-acquisition Doppler price
- Range objective: approximately `-5.5% / +6%` around the anchor, rounded outward to valid tick-spacing boundaries
- Seed target before final recalculation: about `0.464 WETH` plus `4.35B SENTINEL`
- Objective: roughly `$1,000` two-way trades with materially lower impact than the launch pool

The exact ticks and token amounts MUST be recomputed after Phase 3. Do not hard-code the pre-acquisition `229999` price into pool initialization.

If a v3 SENTINEL/WETH pool already exists at fee `3000`, execution MUST NOT create a duplicate; inspect the existing pool state and decide whether to mint into that pool instead.

## Phase 5 — post-launch market acceptance tests

After the standard position is minted, do not advertise healthy two-way liquidity until read-only quotes and small smoke tests demonstrate all of the following:

- `$100` WETH->SENTINEL quote succeeds.
- `$100` SENTINEL->WETH quote succeeds.
- `$1,000` WETH->SENTINEL quote succeeds within the approved impact ceiling.
- `$1,000` SENTINEL->WETH quote succeeds within the approved impact ceiling.
- Doppler quotes still work independently.
- Companion-pool spot price is reasonably synchronized with Doppler after arbitrage/price discovery.
- LP NFT owner/custody is recorded.
- No Airlock beneficiary or migration state changed.

A `$10,000` target is a later scale-up gate, not the first deployment target.

## Phase 6 — market roles

Operationally treat the venues as separate layers:

- **Doppler / Uniswap v4:** launch auction, original beneficiary fee accounting, price discovery and legacy launch provenance.
- **Standard Uniswap v3 companion pool:** normal post-launch two-way market and externally understandable concentrated liquidity.

Do not describe the v3 market as a replacement for the Doppler/Airlock state. It is an additional market venue for the same token.

## Broadcast gate

This document does not authorize a mainnet financial transaction by itself. Before any WETH acquisition or v3 pool mint, capture a fresh quote and produce the exact transaction inputs, expected outputs, slippage bounds, wallet, gas estimate and decoded calldata for review/signature.
