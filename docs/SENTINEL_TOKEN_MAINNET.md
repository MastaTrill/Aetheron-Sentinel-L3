# Canonical SENTINEL Token — Base Mainnet

## Canonical deployment

| Field | Value |
|---|---|
| Network | Base Mainnet |
| Chain ID | `8453` |
| Contract | `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3` |
| Explorer | <https://basescan.org/token/0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3> |
| On-chain name | `SENTINEL` |
| On-chain symbol | `SENTINEL` |
| Decimals | `18` |
| Verified implementation name | `DERC20` |
| Proxy | No |
| Compiler shown by BaseScan | `v0.8.26+commit.8a97fa7a` |

This address is the canonical Sentinel token for the Aetheron Sentinel L3 ecosystem. Integrations must load it from `deployments/base-mainnet.json`; do not duplicate the address in application code.

## Important repository distinction

`contracts/SentinelToken.sol` is a separate, legacy/custom token design. It has different metadata, supply, allocation logic, staking behavior, and mint authority. It is **not** the verified source for the canonical Base deployment above. Until a formal migration decision is approved, it must not be deployed or described as the canonical token.

## Operator-captured live state

The current operator evidence is preserved in `docs/evidence/SENTINEL_MAINNET_LIVE_STATE_2026-07-26.md`. Material observations include:

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

These values must be reproduced through a second trusted RPC provider before release approval.

## Administrative capabilities of the deployed token

The verified ABI exposes the following security-sensitive functions:

- `owner()` and `transferOwnership(address)`
- `renounceOwnership()`
- `updateMintRate(uint256)`
- `mintInflation()`
- `lockPool(address)` and `unlockPool()`
- `updateTokenURI(string)`

It also exposes ERC-20 burn, ERC-2612 permit, ERC20Votes delegation/checkpoints, and vesting release functions.

ABI availability does not establish that an Aetheron wallet can invoke an owner-only method. The observed token owner is a launch-controller contract, not an Aetheron Safe or externally owned wallet.

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

The release must not assume a direct Safe transfer or supported migration path until the exact controller and migrator bytecode and source establish such a path.

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

Two liquidity positions and four fee beneficiaries were returned by the initializer. The identities and intended economic roles of all beneficiaries must be approved before release.

The token's dead-address `pool()` value and `isPoolUnlocked() == false` must not be treated alone as proof that the associated V4 market is either freely tradable or disabled. Release claims require pool-specific swap, routing, fee, and liquidity evidence.

## Production governance policy

### Deployed authority model

Before public promotion, listing, presale integration, or material liquidity activity:

1. Verify the exact source and runtime bytecode of the controller, initializer, migrator, hook, and pool manager.
2. Determine whether any supported ownership-transition, migration, recovery, or governance path exists.
3. Document whether token-owner powers remain usable, externally controlled, permanently inaccessible, or transition to another controller.
4. Decide in writing whether to accept the deployed model, perform a verified supported transition, migrate/redeploy, or reject this deployment as production.
5. Publish every material privilege, beneficiary, and economic risk.

A Safe multisig remains the preferred controller for any Aetheron-controlled production authority. However, repository documentation must not claim that the current deployment is Safe-controlled unless the on-chain owner and call path prove it.

### Inflation

- Publish the current `yearlyMintRate()` value and its exact interpretation from verified source.
- Publish the contract-enforced maximum rate confirmed from verified source.
- Determine which address or contract can invoke or alter inflation-related functions.
- Treat every successful `mintInflation()` call as a supply event requiring release notes.
- Never describe the token as fixed-supply while inflation capability exists or its reachability is unresolved.
- Treasury accounting must reconcile total supply before and after each mint.

### Pool controls, liquidity, and fees

- Publish both the token-level `pool()` getter and the actual V4 pool key/ID.
- Confirm the exact semantic meaning of initializer status `2` from the deployed implementation.
- Publish pair assets, pool manager, hook, fee schedule, tick spacing, positions, beneficiaries, and fee-collection rules.
- Preserve successful swap-event evidence and perform a separately authorized minimal buy-and-sell smoke test.
- Determine whether cumulative fee getters represent pending, claimable, or historical accounting.
- Do not claim liquidity is locked, burned, withdrawable, migratable, protocol-owned, or immutable without architecture-specific evidence.

### Token metadata

The immutable on-chain symbol is `SENTINEL`. Marketing may refer to the token as “Sentinel,” but integrations and listings must use the exact on-chain symbol. Do not advertise `$SENT` as the ticker unless the token is migrated or listing venues explicitly map that alias.

## Required launch evidence

The release is blocked until all rows are complete.

| Evidence | Status | Reference |
|---|---|---|
| Canonical deployment manifest | Partial | `deployments/base-mainnet.json` requires reproducible live values |
| Source verified on BaseScan | Complete | Explorer contract page |
| Operator on-chain verification | Complete | `docs/evidence/SENTINEL_MAINNET_LIVE_STATE_2026-07-26.md` |
| Independent second-RPC reproduction | Pending | Attach reviewer output |
| Current token owner identified | Complete | Controller address recorded |
| Controller authority and transition paths verified | Pending | Exact source/bytecode review |
| Governance and timelock consequences reviewed | Pending | Architecture decision |
| Mint-rate authority documented | Pending | Exact call-path review |
| Vesting parameters documented | Complete | Operator evidence |
| Beneficiary identities and allocations approved | Pending | Final allocation table |
| V4 pool key and positions documented | Complete | Operator evidence |
| Swap and routing evidence | Pending | Event logs and smoke-test receipts |
| Fee accounting and collection semantics | Pending | Independent review |
| Independent security review | Pending | Review report |
| Incident response contacts | Pending | Private runbook reference |

## Verification

Install Foundry and run:

```bash
BASE_RPC_URL=https://mainnet.base.org bash scripts/verify-canonical-token.sh
```

Save the complete output as a release artifact. Repeat material reads through a second trusted RPC provider. Populate the manifest only from reproducible on-chain reads and transaction receipts.

## Ownership and migration safety

Read-only inspection is approved. Direct governance transactions are not.

Do not generate or broadcast `transferOwnership`, `migrate`, pool-management, minting, metadata, or fee-collection calls merely because an ABI exposes them. First establish the exact authorized caller, call path, preconditions, post-state, and written release authorization.

Never paste private keys into shell history, repositories, chat, CI variables visible to forks, or deployment logs.

## Security verdict

The deployed token is source-verified and non-proxy, and substantial live controller and V4 state has been captured. However, production approval remains blocked because the actual authority model, dead governance/timelock consequences, beneficiary identities, swap behavior, fee semantics, inflation reachability, and independent review are not complete.
