# Deployment Ownership Checklist

This checklist assumes you want every privileged path to terminate at your wallet, your multisig, or explicitly approved service accounts only.

Deployment automation:

- Use `scripts/deploy.cjs` with `.env` values copied from `.env.example`.
- If `SENTINEL_OWNER` equals the deploying account, the script also performs owner-only post-deploy setup.
- If `SENTINEL_OWNER` is a different account or multisig, the script deploys safely and prints the exact pending owner actions to execute afterward.
- Use `npm run deploy:local`, `npm run deploy:testnet`, or `npm run deploy:mainnet`.

Owner handoff automation:

- If deployer is not the final owner, run `npm run setup:ownership -- --network sepolia` from an environment where `OWNER_PRIVATE_KEY` is the `SENTINEL_OWNER` key.
- This script executes the checklist actions for timelock role grants, monitor/reporter authorization, bridge/rate-limiter limits, and core loop component wiring.

## 1. Deploy With Explicit Ownership

Deploy these contracts with your final owner address as the constructor `initialOwner` argument:

- `AetheronBridge(initialOwner)`
- `RateLimiter(initialOwner)`
- `CircuitBreaker(initialOwner)`
- `SentinelInterceptor(anomalyThreshold, tvlThreshold, autonomousMode, initialOwner)`
- `SentinelMonitor(initialOwner)`
- `SentinelYieldMaximizer(initialOwner)`
- `SentinelToken(initialOwner)`
- `SentinelCoreLoop(initialOwner)`
- `SentinelAMM(initialOwner)`
- `SentinelPredictiveThreatModel(initialOwner)`
- `SentinelOracleNetwork(initialOwner)`
- `SentinelMultiSigVault(initialOwner)`
- `SentinelZKOracle(initialOwner)`
- `SentinelInsuranceProtocol(sentinelCore, sentinelAuditor, initialOwner)`
- `SentinelHomomorphicEncryption(initialOwner)`
- `SentinelReferralSystem(rewardToken, initialOwner)`
- `SentinelQuantumKeyDistribution(initialOwner)`
- `SentinelQuantumNeural(initialOwner)`
- `SentinelZKIdentity(initialOwner)`
- `SentinelSocialRecovery(zkIdentityContract, initialOwner)`

Contracts using OpenZeppelin Governor (no `Ownable`):

- `SentinelGovernance(IVotes token, TimelockController timelock, ...)` — authority is the `TimelockController`; grant `TIMELOCK_ADMIN_ROLE` and `PROPOSER_ROLE` to your multisig before revoking the deployer's admin role.

Recommended owner target:

- Production: your multisig or hardware-wallet-controlled admin account
- Staging: your dedicated deployment admin wallet
- Never: a throwaway deployer EOA as the final owner

AccessControl-only deployment:

- `SentinelLiquidityMining(lpToken, rewardToken, rewardPerSecond, initialOwner)`

Security note:

- `SentinelLiquidityMining` does not use `owner()`; its control plane is `DEFAULT_ADMIN_ROLE` and `REWARD_DISTRIBUTOR_ROLE`, both now granted to `initialOwner`.

## 2. Bridge Authorization

After deploying `AetheronBridge`:

1. Call `setRelayer(relayerAddress, true)` for each relayer you control.
2. Do not grant `RELAYER_ROLE` directly unless you intentionally want alternate admin flows.
3. Call `setTokenSupport(token, true)` only for approved assets.
4. Call `setChainLimit(chainId, limit)` for each supported destination chain.

Security note:

- `withdrawFees()` now always pays `owner()`.
- No bridge relayer is trusted by default.

## 3. Rate Limiter Authorization

After deploying `RateLimiter`:

1. Call `setCaller(bridgeAddress, true)`.
2. Call `setCaller(anyOtherAuthorizedExecutor, true)` only if it is under your control.
3. Avoid leaving extra callers authorized.
4. Configure each chain with `setChainLimit()` and `setChainResetPeriod()`.

Security note:

- No caller is trusted by default anymore.

## 4. Monitoring Authorization

After deploying `CircuitBreaker` and `SentinelInterceptor`:

1. Grant `MONITOR_ROLE` only to monitoring services you control.
2. In `SentinelInterceptor`, also call `addReporter(reporter)` for the same approved monitors.
3. Revoke any temporary test or deployer monitor accounts before production.

## 5. Yield and Token Setup

After deploying `SentinelYieldMaximizer`, `SentinelToken`, and `SentinelLiquidityMining`:

1. Call `setYieldToken(tokenAddress)` on `SentinelYieldMaximizer`.
2. Add live strategies via `addYieldStrategy(protocol, allocation, riskLevel, strategyData)`.
3. Call `setSecurityReporter(reporter, true)` on `SentinelToken` only for trusted reporter accounts you control.
4. Verify `SentinelLiquidityMining` admin roles point only to your intended admin account.

Security note:

- Token rewards now pay from the contract-held reward pool instead of minting beyond the capped supply.

## 6. Ownership Rotation Safety

If you rotate ownership after deployment:

1. Use `transferOwnership(newOwner)` from the current owner.
2. The hardened contracts migrate privileged roles to the new owner and revoke them from the old owner.
3. After transfer, verify:
   - `owner()` is correct
   - old owner no longer has admin/operator privileges
   - relayer/caller/reporter lists still contain only approved addresses

## 7. Final Verification

Before going live, verify all of the following onchain:

- `AetheronBridge.owner()` is your final admin account
- `RateLimiter.owner()` is your final admin account
- `CircuitBreaker.owner()` is your final admin account
- `SentinelInterceptor.owner()` is your final admin account
- `SentinelMonitor.owner()` is your final admin account
- `SentinelYieldMaximizer.owner()` is your final admin account
- `SentinelToken.owner()` is your final admin account
- `SentinelCoreLoop.owner()` is your final admin account
- `SentinelAMM.owner()` is your final admin account
- `SentinelPredictiveThreatModel.owner()` is your final admin account
- `SentinelOracleNetwork.owner()` is your final admin account
- `SentinelMultiSigVault.owner()` is your final admin account
- `SentinelZKOracle.owner()` is your final admin account
- `SentinelInsuranceProtocol.owner()` is your final admin account
- `SentinelHomomorphicEncryption.owner()` is your final admin account
- `SentinelReferralSystem.owner()` is your final admin account
- `SentinelQuantumKeyDistribution.owner()` is your final admin account
- `SentinelQuantumNeural.owner()` is your final admin account
- `SentinelZKIdentity.owner()` is your final admin account
- `SentinelSocialRecovery.owner()` is your final admin account
- every relayer/caller/reporter address is one you control
- `SentinelLiquidityMining` admin and distributor roles point only to your approved addresses
- `SentinelGovernance` timelock admin and proposer roles are held by your multisig (not the deployer EOA)
- no temporary deployer account retains privileged roles

## 8. Post-Deploy Verification Automation

After deploying, export ABIs and verify source on Etherscan:

```sh
# Export compiled ABIs to abis/
npm run export:abis

# Verify on Sepolia (set DEPLOYED_ADDRESSES to the JSON from deploy.cjs output)
DEPLOYED_ADDRESSES='{"SentinelToken":"0x..."}' npm run verify:testnet

# Verify on mainnet
DEPLOYED_ADDRESSES='{"SentinelToken":"0x..."}' npm run verify:mainnet
```

The `verify.cjs` script accepts all the same env vars as `deploy.cjs` (owner, thresholds, token addresses) to reconstruct the exact constructor arguments used.

## 9. CoreLoop Bootstrap Issue Summary (Reviewer Packet)

Issue ID: `coreloop-bootstrap-deadlock`

Impact:

- `SentinelCoreLoop.setSystemComponent(...)` can deadlock on first-time setup when all components are unset.
- The function validated critical components after each single update, which prevented any first component from being set in some call orders.

Observed on Sepolia:

- Ownership and role setup succeeded for bridge/interceptor/rate-limiter/timelock paths.
- `SentinelCoreLoop` component wiring remained at zero addresses because first writes reverted under validation constraints.

Root cause:

- Per-component setter performed strict critical-component validation after every write.
- No atomic bootstrap path existed for first-time initialization.

Code remediation:

- Added guarded one-time `initializeCoreComponents(...)` to set critical components atomically.
- Updated per-component `setSystemComponent(...)` to defer strict validation until all critical components exist.
- Added `coreComponentsBootstrapped` state guard.

Operational remediation:

- Added `scripts/redeploy-coreloop.cjs` for CoreLoop-only redeploy while preserving all other deployed contracts.
- Updated `scripts/setup-ownership.cjs` to call `initializeCoreComponents(...)` when available.

## 10. Redeploy Remediation Checklist (CoreLoop Only)

1. Compile current sources: `npm run compile`.
2. Redeploy only CoreLoop with existing key: `npm run redeploy:coreloop`.
3. Copy the script output JSON and update `DEPLOYED_ADDRESSES` in environment.
4. Re-run owner automation: `npm run setup:ownership -- --network sepolia`.
5. Verify CoreLoop source: `DEPLOYED_ADDRESSES='{"SentinelToken":"0x..."}' npm run verify:testnet`.
6. Run read-only audit checks for:
   - `owner()` alignment
   - Timelock proposer/canceller roles
   - `SentinelCoreLoop` component address wiring
7. Update site/subgraph config with the new `DEPLOYED_ADDRESSES` map if CoreLoop address is consumed downstream.
8. Attach transaction hashes and audit output to PR/release notes for reviewer sign-off.
