# SENTINEL C1FA micro-liquidity preflight — 2026-09-07

**Status:** PRE-BROADCAST / C1FA SIGNATURE REQUIRED

This package sizes the largest clean starter companion market available from assets already held by the canonical SENTINEL owner/treasury wallet without using the unidentified historical trading wallet or changing legacy Doppler/Airlock beneficiary state.

## Canonical custody

- Owner / treasury / LP-NFT recipient: `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` (C1FA)
- SENTINEL: `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`
- WETH (Base): `0x4200000000000000000000000000000000000006`
- Existing Doppler pool ID: `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`
- Existing DecayMulticurveInitializer: `0xD59cE43E53D69F190E15d9822Fb4540dCcc91178`
- New standard Uniswap v3 fee tier: `3000` (0.30%)

## Legacy beneficiary check — do not mutate

Live `getShares(poolId, beneficiary)` reads:

- C1FA: `0`
- legacy creator `0x7e3D11f70084D667295710E6b7FF50C3b0487a45`: `0.57e18` (57%)

Therefore this plan does **not** claim, redirect, or update legacy Doppler beneficiary rights. C1FA ownership applies to new project-controlled liquidity infrastructure only.

## C1FA balances used for sizing

Observed balances:

- Base: ~`0.000001758 ETH`, `0 WETH`, `2,278,624.9014024595 SENTINEL`
- Ethereum: `0.0011688 ETH`
- Polygon: `29.7171255 POL`

No meaningful WETH/USDC balance was found on Base, Ethereum, or Polygon. The Polygon balance is deliberately left untouched in this first stage.

## Stage 1 — canonical Ethereum -> Base bridge

Planned bridge amount: **`0.00085 ETH`** from C1FA on Ethereum to the same C1FA address on Base.

Canonical Base L1StandardBridge:

`0x3154Cf16ccdb4C6d922629664174b904d80F2C35`

Call:

`depositETHTo(C1FA, 200000, 0x)`

Value: `850000000000000 wei`

Calldata:

`0x9a2ac6d5000000000000000000000000a4737aa4b1e8a3c8f221be9e55f5bda307ecc1fa0000000000000000000000000000000000000000000000000000000000030d4000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000`

Alchemy execution simulation: **PASS**. Gas used in simulation: `620,901`.

At the contemporaneous Ethereum gas price (~0.1263 gwei), modeled L1 gas cost is roughly `0.0000784 ETH`; re-quote gas immediately before signing.

## Stage 2 — small Doppler acquisition from C1FA

After the bridge confirms, preserve approximately `0.00005 ETH` on Base as operational gas reserve.

Planning swap input: **`0.0002746 WETH/ETH`** through the existing Doppler v4 pool.

Fresh read-only v4 quote at preparation time:

- input: `0.0002746 WETH`
- output: **`2,640,530.0129522937 SENTINEL`**
- quoter gas estimate: `50,501`

This would leave C1FA with approximately **`4,919,154.914354753 SENTINEL`** total before the v3 mint.

Modeled post-buy state if pool state does not change first:

- tick: approximately `229998`
- sqrtPriceX96: approximately `7816109422920858678535766518781108`

Do not hard-code this modeled post-buy price. Re-read PoolManager after the confirmed acquisition.

## Stage 3 — C1FA-owned companion Uniswap v3 position

Factory check at preparation time: no existing WETH/SENTINEL Uniswap v3 pool at fee tier `3000`.

Planning range:

- lower tick: `229440`
- upper tick: `230580`
- fee: `3000`

At the modeled post-buy price, the C1FA token inventory is approximately balanced by:

- WETH side: **`0.00052538 WETH`**
- SENTINEL side: **`4.91915M SENTINEL`**
- modeled liquidity: ~`1.809748e21`
- approximate LP notional at contemporaneous ETH price: **~$2.6**

The LP NFT recipient MUST be C1FA.

## Execution gates

1. C1FA must be the signing wallet for the Ethereum bridge.
2. Re-check Ethereum balance and gas immediately before signing.
3. Wait for the L1 -> Base deposit to confirm before any Base transaction.
4. Re-read Doppler tick, fee, and quote before the acquisition.
5. Use a hard minimum-out guard on the acquisition.
6. After acquisition receipt, re-read the actual Doppler sqrtPriceX96/tick.
7. Recompute v3 initialization price, tick range amounts, and liquidity from confirmed state.
8. Simulate create/initialize/mint before signing.
9. Mint LP NFT to C1FA only.
10. Verify the legacy Airlock, Doppler positions, and beneficiary shares are unchanged.

No mainnet transaction has been broadcast by this preflight.