# 📋 Deployment Documentation Index

**Sepolia Deployment:** Block 10715441 | **Status:** ✅ COMPLETE

---

## Quick Navigation

### For Stakeholders & Decision-Makers

Start here for executive overview:

- **[DEPLOYMENT_COMPLETE_SUMMARY.md](./DEPLOYMENT_COMPLETE_SUMMARY.md)** ← **START HERE**
  - Executive summary of all 27 contracts deployed
  - Key transaction records and verification status
  - Production decisions locked in
  - Next steps for testnet & mainnet

### For Deployment Verification

Technical verification and auditing:

- **[DEPLOYMENT_OWNERSHIP_CHECKLIST.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md)**
  - 18 comprehensive verification sections
  - All transaction evidence with block numbers & hashes
  - Role-based access verification
  - Allowlist audit results
  - **Sections of interest:**
    - Section 11: Live status snapshot with current state
    - Section 12: Exact timelock role calls (copy-paste ready)
    - Section 14: Timelock handoff execution record
    - Section 16: Bridge relayer go-live commands
    - Section 17: CoreLoop component wiring record
    - Section 18: Production lock-down decisions

### For Release & Compliance

Official release documentation:

- **[RELEASE_NOTES_SEPOLIA_2026-04-23.md](./RELEASE_NOTES_SEPOLIA_2026-04-23.md)**
  - All 27 contract addresses with Etherscan links
  - All critical security handoffs documented
  - Transaction records with timestamps
  - Verification commands ready to run
  - Mainnet preparation checklist

### For Mainnet Deployment

Reusable workflow template:

- **[MAINNET_PREPARATION_TEMPLATE.md](./MAINNET_PREPARATION_TEMPLATE.md)**
  - Step-by-step mainnet deployment guide
  - Pre-deployment decision checklist
  - Identical workflow to Sepolia
  - Rollback strategies
  - Security sign-off checklist

### For Architecture & Security

Design & security documentation:

- **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)** - System design overview
- **[SECURITY_AUDIT_CERTIFICATION.md](./SECURITY_AUDIT_CERTIFICATION.md)** - Security decisions
- **[SECURITY.md](./SECURITY.md)** - General security guidelines

---

## Artifact Locations

### Contract Addresses

- **[site/contracts.js](./site/contracts.js)** - All 27 deployed contracts + Etherscan URLs

### Configuration Files

- **[subgraph.yaml](./subgraph.yaml)** - The Graph indexing config (with exact startBlocks set)
- **[hardhat.config.ts](./hardhat.config.ts)** - Hardhat configuration
- **[pyrightconfig.json](./pyrightconfig.json)** - TypeScript config

### Verification Scripts

| Script                                                                                 | Command                                                                 | Purpose                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------- |
| [scripts/section7-final-sweep.cjs](./scripts/section7-final-sweep.cjs)                 | `node scripts/section7-final-sweep.cjs`                                 | Verify ownership + governance |
| [scripts/audit-allowlists.cjs](./scripts/audit-allowlists.cjs)                         | `node scripts/audit-allowlists.cjs`                                     | Verify role allowlists        |
| [scripts/verify-bridge-relayers.cjs](./scripts/verify-bridge-relayers.cjs)             | `RELAYER_ADDRESSES=0x... node scripts/verify-bridge-relayers.cjs`       | Verify bridge relayer         |
| [scripts/generate-bridge-relayer-safe.cjs](./scripts/generate-bridge-relayer-safe.cjs) | `RELAYER_ADDRESSES=0x... node scripts/generate-bridge-relayer-safe.cjs` | Generate Safe payload         |

### Executed Transactions (Already Mined)

- **[scripts/timelock-role-realignment.sepolia.safe.json](./scripts/timelock-role-realignment.sepolia.safe.json)** - Historical record of 4-tx timelock handoff
- All transactions recorded with block numbers and status=1 in [DEPLOYMENT_OWNERSHIP_CHECKLIST.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md)

---

## Key Metrics

| Metric                        | Value                                         |
| ----------------------------- | --------------------------------------------- |
| **Total Contracts**           | 27 deployed + initialized                     |
| **Deployment Network**        | Sepolia (chainId 11155111)                    |
| **Final Block**               | 10715441                                      |
| **Owner Address**             | 0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB    |
| **Multisig Address**          | 0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994    |
| **Timelock Transactions**     | 4 (blocks 10714527-10714530)                  |
| **Bridge Relayer Enabled**    | ✅ Yes (block 10715425)                       |
| **CoreLoop Components Wired** | 3/5 (block 10715441)                          |
| **Allowlist Audit Result**    | ✅ All members known, no suspicious addresses |
| **Section 7 Verification**    | ✅ All checks pass                            |

---

## Execution Timeline

| Phase                         | Status      | Timeline                 | Evidence                                                                     |
| ----------------------------- | ----------- | ------------------------ | ---------------------------------------------------------------------------- |
| **Deployment**                | ✅ Complete | Block 10707539-10714526  | [site/contracts.js](./site/contracts.js)                                     |
| **Authorization**             | ✅ Complete | Blocks 10707539-10714526 | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md §6](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md)  |
| **Ownership Verification**    | ✅ Complete | Block 10714526           | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md §11](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md) |
| **Timelock Handoff**          | ✅ Complete | Blocks 10714527-10714530 | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md §14](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md) |
| **Bridge Relayer Enablement** | ✅ Complete | Block 10715425           | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md §16](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md) |
| **CoreLoop Wiring**           | ✅ Complete | Block 10715441           | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md §17](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md) |
| **Final Verification**        | ✅ Complete | Block 10715441           | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md §15](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md) |
| **Documentation**             | ✅ Complete | Block 10715441           | This index                                                                   |

---

## Common Tasks

### "I need to verify deployment is correct"

→ Run all three verification scripts:

```bash
node scripts/section7-final-sweep.cjs
node scripts/audit-allowlists.cjs
RELAYER_ADDRESSES=0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB node scripts/verify-bridge-relayers.cjs
```

**Expected Result:** All pass. See [DEPLOYMENT_OWNERSHIP_CHECKLIST.md §15](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md).

### "I need to know what was deployed where"

→ See [DEPLOYMENT_COMPLETE_SUMMARY.md](./DEPLOYMENT_COMPLETE_SUMMARY.md) deployment addresses section or [site/contracts.js](./site/contracts.js) for complete list.

### "I need transaction records for audit/compliance"

→ See [RELEASE_NOTES_SEPOLIA_2026-04-23.md](./RELEASE_NOTES_SEPOLIA_2026-04-23.md) or [DEPLOYMENT_OWNERSHIP_CHECKLIST.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md) sections 12-17.

### "I need to check if The Graph is indexing"

→ The Graph dashboard will show events from [subgraph.yaml](./subgraph.yaml) starting at configured startBlocks:

- SentinelInterceptor: 10707540
- AetheronBridge: 10707539
- RateLimiter: 10707542
- CircuitBreaker: 10707541

### "I need to deploy to mainnet"

→ Follow [MAINNET_PREPARATION_TEMPLATE.md](./MAINNET_PREPARATION_TEMPLATE.md) step-by-step.

### "I need to enable a new bridge relayer"

→ Use [scripts/generate-bridge-relayer-safe.cjs](./scripts/generate-bridge-relayer-safe.cjs) to create Safe payload, or see [MAINNET_PREPARATION_TEMPLATE.md §4](./MAINNET_PREPARATION_TEMPLATE.md) for manual execution.

### "I need to understand the production decisions"

→ See [DEPLOYMENT_COMPLETE_SUMMARY.md](./DEPLOYMENT_COMPLETE_SUMMARY.md) "Production Decisions Locked" or [DEPLOYMENT_OWNERSHIP_CHECKLIST.md §18](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md).

---

## Who Needs What

| Role                   | Primary Doc                                                                  | Secondary Docs                                                                             |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Executive/PM**       | [DEPLOYMENT_COMPLETE_SUMMARY.md](./DEPLOYMENT_COMPLETE_SUMMARY.md)           | [RELEASE_NOTES_SEPOLIA_2026-04-23.md](./RELEASE_NOTES_SEPOLIA_2026-04-23.md)               |
| **DevOps/Engineer**    | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md)     | Verification scripts, [MAINNET_PREPARATION_TEMPLATE.md](./MAINNET_PREPARATION_TEMPLATE.md) |
| **Security Auditor**   | [SECURITY_AUDIT_CERTIFICATION.md](./SECURITY_AUDIT_CERTIFICATION.md)         | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md) §11-18            |
| **Compliance Officer** | [RELEASE_NOTES_SEPOLIA_2026-04-23.md](./RELEASE_NOTES_SEPOLIA_2026-04-23.md) | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md) §14,17            |
| **Frontend Developer** | [site/contracts.js](./site/contracts.js)                                     | [DEPLOYMENT_COMPLETE_SUMMARY.md](./DEPLOYMENT_COMPLETE_SUMMARY.md)                         |
| **The Graph Team**     | [subgraph.yaml](./subgraph.yaml)                                             | [RELEASE_NOTES_SEPOLIA_2026-04-23.md](./RELEASE_NOTES_SEPOLIA_2026-04-23.md)               |

---

## Validation Checklist

Before considering deployment "fully complete":

- [ ] All three verification scripts pass (section7, audit-allowlists, verify-bridge-relayers)
- [ ] Release notes document matches on-chain reality (check tx hashes on Etherscan)
- [ ] The Graph dashboard shows events being indexed
- [ ] Multisig has verified control of timelock (can propose/cancel)
- [ ] Bridge relayer can sign transactions (if applicable)
- [ ] All stakeholders have reviewed documentation
- [ ] Security audit completed (see SECURITY_AUDIT_CERTIFICATION.md)
- [ ] Mainnet preparation checklist reviewed (MAINNET_PREPARATION_TEMPLATE.md)

---

## Support & Escalation

| Issue                                    | Action                                  | Reference                                                                    |
| ---------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| **"Something's not deployed correctly"** | Run verification scripts                | Verification Scripts section above                                           |
| **"I need exact transaction details"**   | Check DEPLOYMENT_OWNERSHIP_CHECKLIST.md | Sections 12-17                                                               |
| **"How do we deploy to mainnet?"**       | Use template workflow                   | [MAINNET_PREPARATION_TEMPLATE.md](./MAINNET_PREPARATION_TEMPLATE.md)         |
| **"Is this secure?"**                    | Review audit doc                        | [SECURITY_AUDIT_CERTIFICATION.md](./SECURITY_AUDIT_CERTIFICATION.md)         |
| **"Who controls what?"**                 | Check checklist section 11              | [DEPLOYMENT_OWNERSHIP_CHECKLIST.md §11](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md) |

---

## Quick Links to Key Addresses

- **Timelock:** [0x670F79bFe0829e491aB0c41A7A93B1E56a09f2a0](https://sepolia.etherscan.io/address/0x670F79bFe0829e491aB0c41A7A93B1E56a09f2a0)
- **Governance:** [0x38427f04abD2a9D938674a41c6dbf592E6e953f0](https://sepolia.etherscan.io/address/0x38427f04abD2a9D938674a41c6dbf592E6e953f0)
- **MultiSig:** [0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994](https://sepolia.etherscan.io/address/0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994)
- **Bridge:** [0x77E4C1EbeAB0c5140dd0F3d60eBf523134DC7597](https://sepolia.etherscan.io/address/0x77E4C1EbeAB0c5140dd0F3d60eBf523134DC7597)
- **All Contracts:** [site/contracts.js](./site/contracts.js)

---

**Last Updated:** April 23, 2026  
**Deployment Block:** 10715441  
**Status:** ✅ Production Ready for Testnet
