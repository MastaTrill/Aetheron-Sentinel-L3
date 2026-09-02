# Legacy SENTINEL Token — Base Mainnet

> **Current release classification:** This document describes a real, live Base Mainnet SENTINEL deployment that is retained as **legacy/non-canonical** evidence. The active release model is controlled redeployment with creator beneficiary `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`. Deployment existence does not promote this token back to canonical release status.

## Deployed legacy token

| Field | Value |
|---|---|
| Network | Base Mainnet |
| Chain ID | `8453` |
| Contract | `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3` |
| Creation transaction | `0x0733e1e5700ed354298511dd09d3966c8c02093700074cf97d6d231b4544a776` |
| Explorer | <https://basescan.org/token/0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3> |
| On-chain name | `SENTINEL` |
| On-chain symbol | `SENTINEL` |
| Decimals | `18` |
| Recorded total supply | `100000000000000000000000000000` (100 billion tokens) |
| Verified implementation name | `DERC20` |
| Proxy | No |
| Compiler shown by BaseScan | `v0.8.26+commit.8a97fa7a` |
| Recorded token owner/controller | `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12` |
| Release status | `legacy-non-canonical` |

The machine-readable Base inventory records this deployment under `tokens.sentinelLegacy` in `deployments/base-mainnet.json`. The current controlled-redeployment decision is recorded separately in `release-evidence/sentinel-mainnet/redeployment-closure.json`.

## Why this is not the current replacement deployment

The repository selected a controlled replacement path after authority/beneficiary review of this deployment. The replacement evidence currently records:

- release model: `controlled-redeployment`;
- replacement status: `preparation-only`;
- creator beneficiary: `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`;
- creator share: `570000000000000000` (57% WAD);
- Base Mainnet deployment gate: `pending`;
- deployment receipt: `status: "prepared"`;
- no replacement deployment transaction hash in the closure record.

The prepared/predicted replacement token address is `0x7C7528F49BdB879e5E10C93503E6590665c13FC8`. A read-only Base Mainnet check on 2026-09-02 returned no runtime bytecode at that address, which is consistent with the repository's prepared/not-deployed state.

## Preserved live-state evidence for the legacy deployment

The detailed operator capture is preserved in `docs/evidence/SENTINEL_MAINNET_LIVE_STATE_2026-07-26.md`, with second-RPC material under `release-evidence/sentinel-mainnet/second-rpc/`.

Material recorded observations include:

| Field | Observed value |
|---|---|
| Total supply | `100000000000000000000000000000` |
| Token owner | `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12` |
| Token `pool()` | `0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD` |
| `isPoolUnlocked()` | `false` |
| `yearlyMintRate()` | `20000000000000000` |
| `lastMintTimestamp()` | `0` |
| `vestingStart()` | `1771801399` |
| `vestingDuration()` | `0` |
| `vestedTotalAmount()` | `0` |
| Token URI | `ipfs://bafkreih43tnu76b2mrcvankahfmlgzcpgjmknzdmrclqezig4dtkpjm7wy` |
| Runtime bytecode hash | `0xe7d4b4aa522391b024d0fb85175196809a646c069498975e7e927c77e476d672` |

These values describe the legacy deployment and remain useful for forensics, migration analysis, and regression checks. They are not launch approval for that deployment.

## Administrative capabilities observed on the legacy token

The verified ABI exposes security-sensitive functions including:

- `owner()` and `transferOwnership(address)`;
- `renounceOwnership()`;
- `updateMintRate(uint256)`;
- `mintInflation()`;
- `lockPool(address)` and `unlockPool()`;
- `updateTokenURI(string)`.

It also exposes ERC-20 burn, ERC-2612 permit, ERC20Votes delegation/checkpoints, and vesting release functions.

ABI availability does not establish that an Aetheron wallet can invoke owner-only methods. The observed owner is a launch-controller contract, not the Aetheron Platform owner wallet.

## Observed controller and asset configuration

| Field | Observed value |
|---|---|
| Token owner/controller | `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12` |
| Controller owner | `0x21E2ce70511e4FE542a97708e89520471DAa7A66` |
| Numeraire | Base WETH, `0x4200000000000000000000000000000000000006` |
| Timelock field | `0x000000000000000000000000000000000000dEaD` |
| Governance field | `0x000000000000000000000000000000000000dEaD` |
| Migrator | `0x6ddfED58D238Ca3195E49d8ac3d4cEa6386E5C33` |
| Initializer | `0xD59cE43E53D69F190E15d9822Fb4540dCcc91178` |
| Migration-pool field | `0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD` |
| Integrator | `0xF60633D02690e2A15A54AB919925F3d038Df163e` |

Do not assume a supported ownership transition, migration, or recovery path merely from these fields. Any write operation requires its own exact caller/authority proof and release authorization.

## Observed Uniswap V4 configuration

| Field | Observed value |
|---|---|
| Pool ID | `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d` |
| Pool manager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Currency 0 | Base WETH |
| Currency 1 | SENTINEL |
| Raw initializer status | `2` |
| Dynamic fee field | `8388608` |
| Tick spacing | `200` |
| Hook | `0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0` |
| Raw fee schedule | start `800000`, end `12000`, last `12000`, duration `10` seconds |

The token's dead-address `pool()` value and `isPoolUnlocked() == false` do not by themselves prove whether the V4 market is freely tradable or disabled. Market claims require pool-specific routing, swap, fee, and liquidity evidence.

## Current release evidence

| Evidence | Status | Reference |
|---|---|---|
| Legacy deployment inventory | Complete | `deployments/base-mainnet.json` |
| Legacy source verification | Complete | BaseScan contract page |
| Legacy operator live-state capture | Complete | `docs/evidence/SENTINEL_MAINNET_LIVE_STATE_2026-07-26.md` |
| Legacy second-RPC evidence | Preserved | `release-evidence/sentinel-mainnet/second-rpc/` |
| Controlled replacement exact manifest | Complete | `release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json` |
| Controlled replacement Base Sepolia rehearsal | Complete | `release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal.json` |
| Exact Base Mainnet authorization evidence | Recorded for its exact authorized commit and manifest | `release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json` |
| Replacement Base Mainnet deployment | Pending | `release-evidence/sentinel-mainnet/redeployment-closure.json` |
| Replacement deployment receipt | Prepared only | `release-evidence/sentinel-mainnet/redeployment/deployment-receipt.json` |
| Post-deployment authority/RPC verification | Pending | closure gates |
| Authorized replacement buy/sell smoke test | Pending | closure gates |
| Immutable final evidence package | Pending | closure gates |

## Integration rule

Do not call `0x8c1e…0ba3` the current canonical SENTINEL release token. If an integration needs to display the historical/live deployment, label it **legacy Base Mainnet SENTINEL** and source it from `deployments/base-mainnet.json`.

Do not point production integrations at the prepared replacement address until a successful Base Mainnet deployment receipt, runtime bytecode, authority verification, and the remaining release evidence are recorded.

## Safety

Read-only inspection is allowed. Do not generate or broadcast ownership, migration, minting, pool-management, fee-collection, liquidity, or trading transactions merely because the deployed ABI exposes those functions. Private keys, wallet seed phrases, and protected deployment secrets must never be committed or pasted into chat or logs.
