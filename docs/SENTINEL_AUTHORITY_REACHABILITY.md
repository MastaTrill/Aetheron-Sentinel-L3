# Canonical SENTINEL authority reachability

**Network:** Base Mainnet (`8453`)  
**Token:** `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`  
**Token owner:** Doppler Airlock `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12`  
**Airlock owner:** external 3-of-6 Safe `0x21E2ce70511e4FE542a97708e89520471DAa7A66`

## Finding

The canonical token's owner-only DERC20 methods are **authorized to the Airlock address but not operationally reachable through the verified Airlock interface**.

The exact-match verified Airlock exposes asset creation, migration, module-whitelist administration, protocol/integrator fee collection, and Airlock ownership administration. It does not expose a generic `execute`, `call`, or `delegatecall` entrypoint and does not wrap the token's `updateMintRate`, `unlockPool`, `lockPool`, `updateTokenURI`, `transferOwnership`, or `renounceOwnership` methods.

Consequently:

| Capability | Solidity authorization | Supported operational path | Current conclusion |
|---|---|---|---|
| Change yearly mint rate | Token owner (Airlock) | None in Airlock ABI | Stranded/unreachable |
| Start inflation by unlocking token-level pool | Token owner (Airlock) | None in Airlock ABI | Stranded/unreachable |
| Change token URI | Token owner (Airlock) | None in Airlock ABI | Stranded/unreachable |
| Change or renounce token ownership | Token owner (Airlock) | None in Airlock ABI | Stranded/unreachable |
| Call `mintInflation()` | Public, but requires minting start | Minting start remains zero until `unlockPool()` | Dormant/reverting |
| Migrate the launch | Airlock `migrate(asset)` plus initializer/migrator conditions | Initializer status is Locked (`2`); configured migrator is NoOp | No supported migration |
| Change Airlock owner/modules | Airlock owner Safe | 3-of-6 Safe transaction | Reachable, but does not grant arbitrary token calls |
| Collect Airlock protocol fees | Airlock owner Safe | `collectProtocolFees` | Reachable for Airlock-held protocol fees only |
| Collect Airlock integrator fees | Recorded integrator | `collectIntegratorFees` | Reachable for that integrator's Airlock fees only |
| Trigger V4 fee collection | Any caller | Initializer `collectFees(poolId)` | Reachable; releases only the caller's beneficiary share |
| Move a beneficiary share | Current beneficiary | Initializer `updateBeneficiary(poolId,newBeneficiary)` | Reachable by that beneficiary only |

## Supply-language rule

The token contains a configured `yearlyMintRate` of 2%, so documentation must not call the source code fixed-supply. The defensible statement is:

> The canonical deployment is currently non-minting. Inflation is configured in source but dormant because minting was never started, and no supported Airlock call path to the owner-only unlock or mint-rate functions was found.

## Verification

Run the read-only simulation and preserve its output:

```bash
BASE_RPC_URL=https://base-rpc.publicnode.com \
  bash scripts/verify-sentinel-authority-reachability.sh \
  | tee release-evidence/sentinel-mainnet/authority-reachability.txt
```

An `eth_call` made with `--from` equal to the Airlock can demonstrate that the token's `onlyOwner` check would accept that address. It does **not** demonstrate transaction reachability, because a contract can originate calls only through its deployed code.
