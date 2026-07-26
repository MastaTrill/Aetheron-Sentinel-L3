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

## Administrative capabilities of the deployed token

The verified ABI exposes the following security-sensitive functions:

- `owner()` and `transferOwnership(address)`
- `renounceOwnership()`
- `updateMintRate(uint256)`
- `mintInflation()`
- `lockPool(address)` and `unlockPool()`
- `updateTokenURI(string)`

It also exposes ERC-20 burn, ERC-2612 permit, ERC20Votes delegation/checkpoints, and vesting release functions.

## Production governance policy

### Ownership

Before public liquidity or a presale:

1. The owner must be a Safe multisig, never a single externally owned account.
2. Recommended minimum policy: 2-of-3 for development, moving to 3-of-5 before material public funds are accepted.
3. Signers should use separate hardware wallets and should not share seed phrases or devices.
4. The multisig address and signer policy must be published here and in `deployments/base-mainnet.json`.
5. Any ownership transfer transaction must be linked in the release evidence.

### Timelock

Owner-controlled changes should be routed through a timelock where compatible. Recommended delay: at least 48 hours for mint-rate, pool, and metadata changes. Emergency actions should be narrowly defined and publicly logged.

### Inflation

- Publish the current `yearlyMintRate()` value.
- Publish the contract-enforced maximum rate confirmed from verified source.
- Treat every `mintInflation()` call as a supply event requiring release notes.
- Never describe the token as fixed-supply while inflation remains enabled.
- Treasury accounting must reconcile total supply before and after each mint.

### Pool controls and liquidity

- Publish the configured `pool()` address.
- Confirm `isPoolUnlocked()` before claiming the token is freely tradable.
- Publish pair assets, DEX, fee tier, pool address, starting reserves, and LP ownership.
- Do not claim liquidity is locked unless a verifiable lock transaction and unlock date exist.
- Do not burn LP positions without documenting the permanent consequences.
- Run a real buy-and-sell test with small amounts before announcing trading.

### Token metadata

The immutable on-chain symbol is `SENTINEL`. Marketing may refer to the token as “Sentinel,” but integrations and listings must use the exact on-chain symbol. Do not advertise `$SENT` as the ticker unless the token is migrated or listing venues explicitly map that alias.

## Required launch evidence

The release is blocked until all rows are complete.

| Evidence | Status | Reference |
|---|---|---|
| Canonical deployment manifest | Complete | `deployments/base-mainnet.json` |
| Source verified on BaseScan | Complete | Explorer contract page |
| On-chain verification script output | Pending | Attach CI artifact or signed release output |
| Current owner identified | Pending | Populate manifest |
| Owner is approved multisig | Pending | Safe URL and transfer transaction |
| Timelock configured or risk accepted | Pending | Governance record |
| Current mint rate documented | Pending | Populate manifest |
| Vesting parameters documented | Pending | Populate manifest |
| Holder/allocation labels published | Pending | Allocation table |
| Pool address documented | Pending | Populate manifest |
| Pool unlocked | Pending | Verification output |
| Liquidity pair funded | Pending | Pair transaction |
| LP custody/lock documented | Pending | Lock or multisig custody evidence |
| Buy/sell smoke test passed | Pending | Transaction hashes |
| Independent security review | Pending | Audit report |
| Incident response contacts | Pending | Private runbook reference |

## Verification

Install Foundry and run:

```bash
BASE_RPC_URL=https://mainnet.base.org bash scripts/verify-canonical-token.sh
```

Save the complete output as a release artifact. Populate the manifest only from direct on-chain reads and transaction receipts.

## Ownership transaction templates

Read the current owner first. Never broadcast from an address that is not the current owner.

```bash
TOKEN=0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3
RPC_URL="$BASE_RPC_URL"
cast call "$TOKEN" 'owner()(address)' --rpc-url "$RPC_URL"
```

After creating and verifying the Safe multisig, generate—but review before broadcasting—the ownership transfer calldata:

```bash
SAFE_ADDRESS=0xYourVerifiedSafe
cast calldata 'transferOwnership(address)' "$SAFE_ADDRESS"
```

The transaction must be sent through the current owner's wallet. Do not paste private keys into shell history, repositories, chat, CI variables visible to forks, or deployment logs.

## Security verdict

The deployed token is source-verified and non-proxy, but launch readiness depends on live owner, mint-rate, vesting, pool, liquidity, and holder-distribution state. Until those facts are captured and governance is hardened, its release state is **canonical but not production-approved**.
