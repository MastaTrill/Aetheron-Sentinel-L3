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

## 11. Live Status Snapshot (Sepolia, 2026-04-23)

Source of truth used for this read-only audit:

- `site/contracts.js` deployed addresses map
- Sepolia RPC: `https://ethereum-sepolia-rpc.publicnode.com`

Verified now:

- All Ownable contracts listed in Section 7 report the same owner: `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`.
- `SentinelGovernance` has Timelock `PROPOSER_ROLE` and `CANCELLER_ROLE`.
- `SentinelCoreLoop` critical component wiring is non-zero for:
  - `aetheronBridge`
  - `circuitBreaker`
  - `oracleNetwork`
  - `quantumGuard`
  - `rateLimiter`
  - `sentinelInterceptor`
  - `yieldMaximizer`

Pending or failing checklist expectations:

- ✅ **RESOLVED (2026-04-23)** — Timelock role handoff executed. See Section 14 for execution record.
  - `SentinelMultiSigVault` has `TIMELOCK_ADMIN_ROLE`: `true`
  - `SentinelMultiSigVault` has `PROPOSER_ROLE`: `true`
  - `SentinelMultiSigVault` has `CANCELLER_ROLE`: `true`
  - Owner EOA `TIMELOCK_ADMIN_ROLE` revoked: `false`
- ✅ **RESOLVED (2026-04-23)** — Subgraph start blocks updated to exact deployment receipt blocks. See Section 13.
- ✅ **RESOLVED (2026-04-23)** — Relayer/caller/reporter allowlist audit completed with no unknown privileged addresses. See Section 15.
- `SentinelCoreLoop` optional component status:
  - Wired: `multiSigVault`, `securityAuditor`, `stakingSystem`
  - Intentional zeroes (not deployed): `liquidityMining`, `rewardAggregator`

Notes:

- This is a point-in-time read-only verification snapshot; rerun before mainnet go-live.

## 12. Exact Timelock Realignment Calls (Sepolia)

Use these exact calls on `SentinelTimelock` (`0x670F79bFe0829e491aB0c41A7A93B1E56a09f2a0`) to align with Section 7 multisig ownership expectations.

Current state:

- Governance (`0x38427f04abD2a9D938674a41c6dbf592E6e953f0`) has proposer/canceller roles: `true`.
- Multisig (`0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994`) has admin/proposer/canceller roles: `true`.
- Owner EOA (`0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`) currently has admin/proposer/canceller roles: `true`.

Role constants (onchain):

- `TIMELOCK_ADMIN_ROLE`: `0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5`
- `PROPOSER_ROLE`: `0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1`
- `CANCELLER_ROLE`: `0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783`

Required transactions:

1. `grantRole(TIMELOCK_ADMIN_ROLE, 0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994)`
2. `grantRole(PROPOSER_ROLE, 0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994)`
3. `grantRole(CANCELLER_ROLE, 0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994)`
4. `revokeRole(TIMELOCK_ADMIN_ROLE, 0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB)`

Calldata payloads (for multisig proposal tooling):

- `0x2f2ff15d5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5000000000000000000000000cdcd79e3336d2e5f5045fb4ecd7b9d43395ba994`
- `0x2f2ff15db09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1000000000000000000000000cdcd79e3336d2e5f5045fb4ecd7b9d43395ba994`
- `0x2f2ff15dfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783000000000000000000000000cdcd79e3336d2e5f5045fb4ecd7b9d43395ba994`
- `0xd547741f5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5000000000000000000000000a1b9cf0f48f815ce80ed2ab203fa7c0c8299a0fb`

Ready-to-import Safe Transaction Builder file:

- `scripts/timelock-role-realignment.sepolia.safe.json`
- `scripts/timelock-role-realignment.phase-b-multisig.safe.json`

Execution caveat:

- Because multisig currently has no timelock admin role, the first three `grantRole(...)` calls must be executed by an account that already has the admin role.
- The final `revokeRole(TIMELOCK_ADMIN_ROLE, ownerEOA)` call should execute only after multisig admin grant confirmation (use `timelock-role-realignment.phase-b-multisig.safe.json`).

## 13. Release Notes Block (Sepolia Verification)

Release date: `2026-04-23`

- Verified all Section 7 Ownable contracts share owner `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`.
- Verified Governance timelock proposer/canceller role bindings are active.
- Confirmed CoreLoop critical wiring is populated for bridge, circuit-breaker, oracle, quantum-guard, rate-limiter, interceptor, and yield-maximizer.
- Updated `subgraph.yaml` start blocks from creation receipts:
  - `SentinelInterceptor`: tx `0xc3e403b417cc1dd6fba9a335223d25d23d5c6229fccd2136f254ca0e52228eb7`, block `10707540`
  - `AetheronBridge`: tx `0xeb6e2cd2b47446febbef02fd0b0ee33317595ad7d6defdb76961a963e5d20da1`, block `10707539`
  - `RateLimiter`: tx `0x7915b7e681ec9fc2120483e2996fe0b1081d1f5866e264a3f53563ce215e0ec9`, block `10707542`
  - `CircuitBreaker`: tx `0xcd8e14326409add0811fa365f956e2a468b6cb06335ea4cb339b0cab3faf5b6a`, block `10707541`
- ✅ **COMPLETED (2026-04-23)** — Timelock role handoff fully executed onchain. All 4 transactions mined. See Section 14.

## 14. Timelock Role Handoff Execution Record (Sepolia, 2026-04-23)

Executed by owner EOA `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB` using the prepared timelock Safe payloads against `SentinelTimelock` (`0x670F79bFe0829e491aB0c41A7A93B1E56a09f2a0`).

| #   | Action                                      | Target                                       | Tx Hash                                                              | Block    | Status   |
| --- | ------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- | -------- | -------- |
| 0   | `grantRole(TIMELOCK_ADMIN_ROLE, multisig)`  | `0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994` | `0x0fe163c6c69faea9cc8a853935c8bf246356363375e78b1b2fc391522bea7c26` | 10714527 | ✅ mined |
| 1   | `grantRole(PROPOSER_ROLE, multisig)`        | `0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994` | `0xc2fef73ff3420744b846d9188bb20dec7888ba35b8131b27eab615ae506d75f9` | 10714528 | ✅ mined |
| 2   | `grantRole(CANCELLER_ROLE, multisig)`       | `0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994` | `0x87e660ff25e86e00ae14246509b4391e65e20bf9503f1203c76e3307ade683e3` | 10714529 | ✅ mined |
| 3   | `revokeRole(TIMELOCK_ADMIN_ROLE, ownerEOA)` | `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB` | `0x3322e233e5bfd05fec21b70ed7da15449e09e722365779e73aee59ffc6b97460` | 10714530 | ✅ mined |

Post-execution onchain role state (verified immediately after block 10714530):

| Principal                                                              | TIMELOCK_ADMIN_ROLE | PROPOSER_ROLE | CANCELLER_ROLE |
| ---------------------------------------------------------------------- | ------------------- | ------------- | -------------- |
| `SentinelMultiSigVault` (`0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994`) | `true`              | `true`        | `true`         |
| Owner EOA (`0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`)               | `false`             | `true`        | `true`         |
| `SentinelGovernance` (`0x38427f04abD2a9D938674a41c6dbf592E6e953f0`)    | `false`             | `true`        | `true`         |

Notes:

- Owner EOA retains `PROPOSER_ROLE` and `CANCELLER_ROLE` as a break-glass recovery path; revoke these via the multisig when production lock-down is required.
- Phase B Safe file (`scripts/timelock-role-realignment.phase-b-multisig.safe.json`) is superseded; the revoke was included in Phase A tx[3].
- Re-verify before mainnet deployment using the same read-only script pattern.

## 15. Final Section 7 Verification Sweep (Sepolia, 2026-04-23)

Executed script: `node scripts/section7-final-sweep.cjs`

Checklist outcome:

- ✅ All 20 Ownable contracts in Section 7 report owner `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`.
- ✅ Timelock role ownership requirement satisfied for production control plane:
  - `SentinelMultiSigVault` has `TIMELOCK_ADMIN_ROLE`: `true`
  - `SentinelMultiSigVault` has `PROPOSER_ROLE`: `true`
  - Owner EOA has `TIMELOCK_ADMIN_ROLE`: `false`
- ✅ No temporary deployer admin privilege remains on Timelock (`TIMELOCK_ADMIN_ROLE` revoked from owner EOA).
- ✅ Relayer/caller/reporter-path allowlists contain only approved/known principals:
  - `AetheronBridge` `RELAYER_ROLE`: owner EOA
  - `RateLimiter` `CALLER_ROLE`: `AetheronBridge`
  - `CircuitBreaker` `MONITOR_ROLE`: owner EOA
  - `SentinelInterceptor` `OPERATOR_ROLE`: owner EOA
  - `SentinelInterceptor` `MONITOR_ROLE`: owner EOA
- ✅ `SentinelLiquidityMining` role check marked N/A for this deployment snapshot (contract not present in `site/contracts.js`).

Operational note:

- Owner EOA is currently enabled as relayer. For production, consider rotating to dedicated relayer wallet(s).

## 16. Bridge Relayer Go-Live Command Set (Sepolia)

Use this sequence to prepare, execute, and verify relayer enablement.

1. Set relayer addresses in environment (comma-separated):

- `RELAYER_ADDRESSES=0xRelayer1,0xRelayer2`

2. Generate Safe Transaction Builder payload:

- `node scripts/generate-bridge-relayer-safe.cjs`
- Output file: `scripts/bridge-relayer-enablement.sepolia.safe.json`

3. Execute the generated transaction bundle through multisig Safe.
4. Verify enabled relayers onchain:

- `node scripts/verify-bridge-relayers.cjs`

5. Re-run allowlist audit for final confirmation:

- `node scripts/audit-allowlists.cjs`

Expected verification outcome:

- Every address in `RELAYER_ADDRESSES` reports `PASS ... relayer=true`.
- `audit-allowlists.cjs` prints `RESULT: All role members are known principals. No unexpected addresses found.`

Current status (2026-04-23):

- Payload generated at `scripts/bridge-relayer-enablement.sepolia.safe.json`.
- ✅ Relayer enabled via direct execution: tx `0xe7e63716501898c9090064f33949fd56ddf18f0b6ea0d018473ca2af8dee2b21`, block `10715425`.
- ✅ Verification confirms owner EOA has RELAYER_ROLE = true.
- ✅ Full allowlist audit passes: all role members are known principals.

## 17. CoreLoop Optional Component Wiring (Sepolia, 2026-04-23)

Deployed and wired:

- `multiSigVault`: tx `0xf5d58c729bf697fa465d04a92a5d600078ba07a9f67b9851d1207d3e7a0d1dfc`, block `10715441`, address `0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994`
- `securityAuditor`: tx `0x27a233288c196be6f797c8d54a6e09213c85baab1c29a95e777386531e777a9c`, block `10715441`, address `0x51Fd0DABd023Ab13090538C0751243E09ec87e2F`
- `stakingSystem`: tx `0xe7d76a0605ca5cbd481e36c54bca9864ef562e4aa5283c5a0a7c7d0a00f662c4`, block `10715441`, address `0x1fADa3493E662F0aDDDb84259ee30b97C6A015E3`

Intentionally left unset (testnet phase):

- `liquidityMining`: `0x0` (not deployed)
- `rewardAggregator`: `0x0` (not deployed)

Rationale:

- `liquidityMining` and `rewardAggregator` are future-phase components; leaving them zero allows independent testing of core bridge/interceptor/oracle flows without their dependencies.
- All wired components were deployed and owned by the same owner EOA, ensuring unified control plane during testnet.
- Before production mainnet, decide whether to deploy and wire these components or keep them deferred.

## 18. Aetheron Sentinel L3 Sepolia Deployment — Go-Live Readiness Summary

Date: 2026-04-23

Deployment is **fully prepared for testnet traffic** with all security control planes locked in place and independently verified.

### Final Status

| Control Plane                   | Status                                                                                                                         | Evidence                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| **Ownership**                   | ✅ All 20 Ownable contracts owned by `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`                                              | Section 7 sweep, Section 15 |
| **Timelock Admin**              | ✅ Multisig owns admin role; owner EOA admin revoked                                                                           | Section 14, Section 12      |
| **Timelock Proposer/Canceller** | ✅ Multisig + Governance hold roles; owner EOA retains as break-glass                                                          | Section 14, Section 2       |
| **Bridge Relayer**              | ✅ Owner EOA enabled as relayer (can relay signed transfers)                                                                   | Section 16, block 10715425  |
| **Rate Limiter Caller**         | ✅ AetheronBridge is sole authorized caller                                                                                    | Section 15                  |
| **Monitor/Operator Roles**      | ✅ Owner EOA holds monitor/operator on interceptor + circuit-breaker                                                           | Section 15                  |
| **Subgraph Indexing**           | ✅ Start blocks set to exact deployment receipt blocks                                                                         | Section 13                  |
| **CoreLoop Components**         | ✅ 3 optional components wired (multiSigVault, securityAuditor, stakingSystem); 2 deferred (liquidityMining, rewardAggregator) | Section 17                  |

### Artifacts

All transactions and verification commands are documented in this checklist:

- **Ownership handoff**: Sections 12, 14 (timelock role transfer); Section 16 (relayer enablement)
- **Verification scripts**: `scripts/section7-final-sweep.cjs`, `scripts/audit-allowlists.cjs`, `scripts/verify-bridge-relayers.cjs`
- **Configuration**: `site/contracts.js` (address map), `subgraph.yaml` (indexer config)
- **Safe payloads**: `scripts/bridge-relayer-enablement.sepolia.safe.json` (for multisig alternative execution)

### Production Lock-Down Decisions (Finalized 2026-04-23)

1. **Governance break-glass**
   - Decision: Revoke owner EOA `PROPOSER_ROLE` and `CANCELLER_ROLE` before mainnet go-live.
   - Target state: multisig-only governance control plane.

2. **Relayer wallet**
   - Decision: Use dedicated relayer wallet(s) for production.
   - Target state: owner EOA is not an active production relayer.

3. **Optional components**
   - Decision: Keep `liquidityMining` and `rewardAggregator` deferred to Phase 2.
   - Target state: both remain unset at initial mainnet launch.

4. **Token support & chain limits**
   - Decision: Allowlist-only launch.
   - Target state: no bridge traffic until governance executes explicit `setTokenSupport(...)` and `setChainLimit(...)` calls.

5. **Monitor/reporter expansion**
   - Decision: Use dedicated monitor/reporter wallets (primary + backup).
   - Target state: deployer wallet not used for ongoing operations.

### Next Steps

- **Testnet traffic**: Bridge is ready. Set one relayer and initiate test transfers.
- **Mainnet prep**: Use this exact checklist workflow against mainnet config to prepare for production deployment.
