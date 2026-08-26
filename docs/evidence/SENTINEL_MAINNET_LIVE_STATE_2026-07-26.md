# Canonical SENTINEL Mainnet Live-State Evidence — 2026-07-26

> **Historical legacy evidence:** The deployment recorded below is now classified as legacy/non-canonical. This record is preserved unchanged as an observation of its 2026-07-26 state and does not approve it for release.

## Scope

This record captures read-only Base Mainnet RPC observations for the canonical token:

- Token: `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`
- Network: Base Mainnet (`8453`)
- RPC used by the operator: `https://mainnet.base.org`
- No transaction was signed or broadcast.

This document is an operator evidence record, not an independent audit. A reviewer must reproduce the reads through a second trusted RPC provider before approving release claims.

## Token state

Captured by `scripts/verify-canonical-token.sh`.

| Field | Observed value |
|---|---|
| Name | `SENTINEL` |
| Symbol | `SENTINEL` |
| Decimals | `18` |
| Total supply | `100000000000000000000000000000` |
| Owner | `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12` |
| Configured token `pool()` | `0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD` |
| `isPoolUnlocked()` | `false` |
| `yearlyMintRate()` | `20000000000000000` |
| `lastMintTimestamp()` | `0` |
| `vestingStart()` | `1771801399` |
| `vestingDuration()` | `0` |
| `vestedTotalAmount()` | `0` |
| `tokenURI()` | `ipfs://bafkreih43tnu76b2mrcvankahfmlgzcpgjmknzdmrclqezig4dtkpjm7wy` |
| Runtime bytecode hash | `0xe7d4b4aa522391b024d0fb85175196809a646c069498975e7e927c77e476d672` |

The token owner is a contract address. These reads do not establish that a direct ownership transfer to an Aetheron-controlled Safe is possible.

## Owner-controller state

Captured at Base block `49133915` on `2026-07-26T09:12:56Z`.

| Field | Observed value |
|---|---|
| Controller address | `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12` |
| Controller runtime bytecode hash | `0x5f38c6f76f62855999df836052fccdc14befc7c067105e727f26ee3f42543acc` |
| Controller `owner()` | `0x21E2ce70511e4FE542a97708e89520471DAa7A66` |

### `getAssetData(token)` raw values

The values below are recorded in the order returned by the queried ABI:

1. Numeraire: `0x4200000000000000000000000000000000000006`
2. Timelock: `0x000000000000000000000000000000000000dEaD`
3. Governance: `0x000000000000000000000000000000000000dEaD`
4. Liquidity migrator: `0x6ddfED58D238Ca3195E49d8ac3d4cEa6386E5C33`
5. Pool initializer: `0xD59cE43E53D69F190E15d9822Fb4540dCcc91178`
6. Pool field: `0x8c1eB8db47d52A8B5e2B1Eb4E5ec9491cE030BA3`
7. Migration-pool field: `0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD`
8. Number of tokens to sell: `100000000000000000000000000000`
9. Initial total supply: `100000000000000000000000000000`
10. Integrator: `0xF60633D02690e2A15A54AB919925F3d038Df163e`

The dead-address governance and timelock values are material release facts. The behavior and authority of the migrator and initializer must be verified from their exact deployed bytecode and verified source before any claim about migration, immutability, or recovery is approved.

## Uniswap V4 initializer state

Captured at Base block `49134199` on `2026-07-26T09:22:22Z`.

| Field | Observed value |
|---|---|
| Numeraire | `0x4200000000000000000000000000000000000006` |
| Raw status | `2` |
| Currency 0 | `0x4200000000000000000000000000000000000006` |
| Currency 1 | `0x8c1eB8db47d52A8B5e2B1Eb4E5ec9491cE030BA3` |
| Raw fee field | `8388608` |
| Tick spacing | `200` |
| Hook | `0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0` |
| Current tick recorded by initializer | `-887200` |

The semantic meaning of raw status `2` must be confirmed against the exact initializer implementation before public documentation labels the pool state.

### Beneficiaries

| Address | Raw share |
|---|---:|
| `0x21E2ce70511e4FE542a97708e89520471DAa7A66` | `50000000000000000` |
| `0x2Cdd33d6FF2a897180c7F4e5a20F018Bf0c16fD1` | `19000000000000000` |
| `0x7e3D11f70084D667295710E6b7FF50C3b0487a45` | `570000000000000000` |
| `0xF60633D02690e2A15A54AB919925F3d038Df163e` | `361000000000000000` |

The raw shares sum to `1000000000000000000`. The identities, authority, and intended economic role of every beneficiary must be documented. The controller owner and integrator addresses are observable from the reads above; the other beneficiary identities remain unverified in this record.

### Positions

| Lower tick | Upper tick | Liquidity | Salt |
|---:|---:|---:|---|
| `120000` | `230000` | `1007574910019761622417283` | `0x00...00` |
| `-887200` | `120000` | `2479495864288162666676267` | `0x00...01` |

## V4 pool key, fee schedule, and accounting

Captured at Base block `49134342` on `2026-07-26T09:27:11Z`.

- Pool ID: `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`
- Pool manager: `0x498581fF718922c3f8e6A244956aF099B2652b2b`
- Hook initializer: `0xD59cE43E53D69F190E15d9822Fb4540dCcc91178`

### Verified pool-key read

| Field | Observed value |
|---|---|
| Currency 0 | `0x4200000000000000000000000000000000000006` |
| Currency 1 | `0x8c1eB8db47d52A8B5e2B1Eb4E5ec9491cE030BA3` |
| Fee field | `8388608` |
| Tick spacing | `200` |
| Hook | `0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0` |

### Raw fee schedule

| Field | Observed value |
|---|---:|
| Starting time | `1771801399` |
| Start fee | `800000` |
| End fee | `12000` |
| Last fee | `12000` |
| Duration seconds | `10` |

Any human-readable percentage interpretation must cite the exact fee-unit semantics of the deployed hook and Uniswap V4 implementation.

### Contract-reported cumulative accounting

| Asset | Raw amount |
|---|---:|
| Currency 0 / WETH | `119420660751378` |
| Currency 1 / SENTINEL | `1149162561900290908746607` |

These getters establish contract-reported accounting values. They do not, by themselves, prove whether the values are currently claimable, already distributed historical totals, or subject to additional accounting rules.

## Release-impact conclusions

1. The canonical token exists, is non-proxy according to the current deployment record, and its core metadata matches the canonical manifest.
2. The token owner is a launch-controller contract, not an Aetheron Safe.
3. The current release plan must not assume that an Aetheron wallet can directly call `transferOwnership`.
4. Governance and timelock are recorded as dead addresses in controller asset data.
5. A V4 pool key, positions, beneficiary schedule, fee schedule, and nonzero accounting values are observable.
6. `pool()` returning a dead-address sentinel and `isPoolUnlocked() == false` must not be interpreted in isolation as proof that all V4 swaps are disabled or enabled.
7. No public claim of unrestricted trading, immutable liquidity, governance control, fee ownership, migration safety, or audit completion is approved by this evidence alone.

## Remaining verification

- Reproduce all reads through a second trusted Base RPC provider.
- Verify exact source and runtime bytecode for the controller, initializer, migrator, hook, and pool manager.
- Confirm the semantic meaning of initializer status `2`.
- Verify migrator behavior and whether any migration or ownership-transition path exists.
- Identify and approve every beneficiary address.
- Retrieve and preserve successful swap-event evidence and, where safe, perform a separately authorized minimal buy/sell smoke test.
- Determine whether cumulative accounting values are pending, historical, or claimable.
- Decide whether permanent controller ownership, dead governance/timelock, and the observed mint-rate configuration are acceptable for the canonical Aetheron release.
- Obtain independent security review and written release authorization.
