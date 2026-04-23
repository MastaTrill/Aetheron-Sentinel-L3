# Aetheron Sentinel L3 Sepolia Deployment — Release Notes

**Date:** 2026-04-23  
**Network:** Sepolia (chainId 11155111)  
**Status:** ✅ Ready for testnet traffic

---

## Executive Summary

Aetheron Sentinel L3 has been fully deployed to Sepolia with all security control planes verified and locked in place. The system is production-ready for testnet use and serves as the deployment template for mainnet.

**Key achievement:** 100% of privileged paths now terminate at the owner EOA, multisig, or explicitly approved service accounts. No temporary deployer roles remain.

---

## Deployment Addresses (Sepolia)

See [site/contracts.js](../site/contracts.js) for complete address map.

### Core Bridge Infrastructure

- **AetheronBridge**: `0x77E4C1EbeAB0c5140dd0F3d60eBf523134DC7597` (deployed block 10707539)
- **RateLimiter**: `0xA084B67baDC91Dd6d8cEec65af73c4F21337A888` (deployed block 10707542)
- **CircuitBreaker**: `0x1FC97c1C54914E9053EDF97C390bF9b3b77eA885` (deployed block 10707541)

### Security & Control

- **SentinelInterceptor**: `0x057c15fA83A008ba65A20b6e0dE91949Ab987954` (deployed block 10707540)
- **SentinelMultiSigVault**: `0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994` (owner)
- **SentinelTimelock**: `0x670F79bFe0829e491aB0c41A7A93B1E56a09f2a0` (governance timelock)
- **SentinelGovernance**: `0x38427f04abD2a9D938674a41c6dbf592E6e953f0` (DAO governor)

### Optional Components (Wired)

- **SentinelStaking**: `0x1fADa3493E662F0aDDDb84259ee30b97C6A015E3` (wired to CoreLoop, block 10715441)
- **SentinelSecurityAuditor**: `0x51Fd0DABd023Ab13090538C0751243E09ec87e2F` (wired to CoreLoop, block 10715441)
- **SentinelMultiSigVault** (CoreLoop): `0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994` (wired to CoreLoop, block 10715441)

### Optional Components (Deferred to Mainnet Phase)

- **LiquidityMining**: Not deployed (intentional for testnet)
- **RewardAggregator**: Not deployed (intentional for testnet)

---

## Critical Security Handoffs Executed

### 1. Timelock Admin Role Transfer (Section 14)

**Objective:** Hand ownership control to multisig while revoking deployer admin access.

| #   | Action                                      | Target   | Tx Hash                                                              | Block    | Status |
| --- | ------------------------------------------- | -------- | -------------------------------------------------------------------- | -------- | ------ |
| 0   | `grantRole(TIMELOCK_ADMIN_ROLE, multisig)`  | Timelock | `0x0fe163c6c69faea9cc8a853935c8bf246356363375e78b1b2fc391522bea7c26` | 10714527 | ✅     |
| 1   | `grantRole(PROPOSER_ROLE, multisig)`        | Timelock | `0xc2fef73ff3420744b846d9188bb20dec7888ba35b8131b27eab615ae506d75f9` | 10714528 | ✅     |
| 2   | `grantRole(CANCELLER_ROLE, multisig)`       | Timelock | `0x87e660ff25e86e00ae14246509b4391e65e20bf9503f1203c76e3307ade683e3` | 10714529 | ✅     |
| 3   | `revokeRole(TIMELOCK_ADMIN_ROLE, ownerEOA)` | Timelock | `0x3322e233e5bfd05fec21b70ed7da15449e09e722365779e73aee59ffc6b97460` | 10714530 | ✅     |

**Break-glass recovery:** Owner EOA retains `PROPOSER_ROLE` and `CANCELLER_ROLE` as an emergency rollback path. Revoke via multisig when production lock-down is required.

### 2. Bridge Relayer Enablement (Section 16)

**Objective:** Enable owner EOA to sign and relay bridge transfers.

- **Action**: `AetheronBridge.setRelayer(0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB, true)`
- **Tx Hash**: `0xe7e63716501898c9090064f33949fd56ddf18f0b6ea0d018473ca2af8dee2b21`
- **Block**: 10715425
- **Status**: ✅ Verified onchain

### 3. CoreLoop Optional Component Wiring (Section 17)

**Objective:** Wire optional security/staking components that are already deployed.

| Component       | Address                                      | Tx Hash                                                              | Block    | Status |
| --------------- | -------------------------------------------- | -------------------------------------------------------------------- | -------- | ------ |
| multiSigVault   | `0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994` | `0xf5d58c729bf697fa465d04a92a5d600078ba07a9f67b9851d1207d3e7a0d1dfc` | 10715441 | ✅     |
| securityAuditor | `0x51Fd0DABd023Ab13090538C0751243E09ec87e2F` | `0x27a233288c196be6f797c8d54a6e09213c85baab1c29a95e777386531e777a9c` | 10715441 | ✅     |
| stakingSystem   | `0x1fADa3493E662F0aDDDb84259ee30b97C6A015E3` | `0xe7d76a0605ca5cbd481e36c54bca9864ef562e4aa5283c5a0a7c7d0a00f662c4` | 10715441 | ✅     |

---

## Verification Artifacts

### Subgraph Configuration (Updated)

File: [subgraph.yaml](../subgraph.yaml)

Start blocks set to exact deployment receipt blocks:

- `SentinelInterceptor`: block 10707540
- `AetheronBridge`: block 10707539
- `RateLimiter`: block 10707542
- `CircuitBreaker`: block 10707541

### Ownership Alignment (Verified)

All 20 Ownable contracts report the same owner: `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`

Run verification: `node scripts/section7-final-sweep.cjs`

### Allowlist Audit (Verified)

All role members are approved principals:

- `AetheronBridge` `RELAYER_ROLE`: owner EOA
- `RateLimiter` `CALLER_ROLE`: AetheronBridge only
- `CircuitBreaker` `MONITOR_ROLE`: owner EOA
- `SentinelInterceptor` `OPERATOR_ROLE`, `MONITOR_ROLE`: owner EOA

Run verification: `node scripts/audit-allowlists.cjs`

---

## Production Lock-Down Decisions

**For mainnet go-live, decide on:**

1. **Governance break-glass** (current: enabled)
   - Keep owner EOA as emergency proposer/canceller, OR
   - Revoke for full multisig-only lock-down

2. **Relayer architecture** (current: owner EOA)
   - Use dedicated relayer wallet, OR
   - Keep owner EOA (acceptable for low-volume testnet phase)

3. **Optional components** (current: liquidityMining & rewardAggregator deferred)
   - Deploy and wire before mainnet go-live, OR
   - Continue deferral to Phase 2

4. **Bridge token support & chain limits** (currently unset)
   - Call `setTokenSupport(tokenAddr, true)` for each supported token
   - Call `setChainLimit(chainId, limit)` for each destination chain

5. **Monitoring roles expansion** (currently: single owner EOA)
   - Add dedicated monitor/reporter wallets, OR
   - Keep owner EOA (acceptable for initial mainnet phase)

---

## Verification Commands

Run these commands to independently verify the current state:

```bash
# Section 7 ownership sweep
node scripts/section7-final-sweep.cjs

# Allowlist audit
node scripts/audit-allowlists.cjs

# Bridge relayer verification
RELAYER_ADDRESSES=0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB node scripts/verify-bridge-relayers.cjs
```

All scripts use public Sepolia RPC endpoint and require no private keys.

---

## Mainnet Preparation Checklist

Use this same deployment workflow for mainnet:

1. **Deploy all contracts** with `SENTINEL_OWNER` set to mainnet multisig/admin address
2. **Run ownership handoff automation** with `OWNER_PRIVATE_KEY` set to deployer key that will execute the 4 timelock transactions
3. **Execute timelock transactions** (via Safe or direct EOA call)
4. **Enable bridge relayer** on dedicated relayer wallet (not owner EOA for production)
5. **Wire CoreLoop components** (deploy liquidityMining & rewardAggregator first if not deferring)
6. **Configure bridge token support & chain limits**
7. **Run final verification suite** and attach outputs to mainnet release PR

---

## Test Coverage & Go-Live Readiness

✅ **Bridge traffic ready:**

- Relayer enabled and verified
- Rate limiter caller configured (bridge only)
- Circuit breaker monitoring active

✅ **Governance ready:**

- Timelock admin transferred to multisig
- Emergency break-glass available via owner EOA if needed

✅ **Security audit ready:**

- All ownership paths verified
- All role assignments verified
- All allowlists verified (no unknown addresses)

---

## Contacts & Issues

- **Deployment runbook**: [DEPLOYMENT_OWNERSHIP_CHECKLIST.md](../DEPLOYMENT_OWNERSHIP_CHECKLIST.md)
- **Script location**: [scripts/](../scripts/)
- **Configuration**: [site/contracts.js](../site/contracts.js), [subgraph.yaml](../subgraph.yaml)
- **Issue tracking**: Use GitHub issues with label `deployment:sepolia` for testnet issues, `deployment:mainnet` for mainnet prep

---

**Release signed off:** 2026-04-23  
**Verification timestamp:** Block 10715441 (Sepolia)
