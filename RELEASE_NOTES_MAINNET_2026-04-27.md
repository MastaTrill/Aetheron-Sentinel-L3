# Aetheron Sentinel L3 Mainnet Release Notes Draft

**Date:** 2026-05-04  
**Network:** Ethereum Mainnet (target) | Current repo evidence: Sepolia rehearsal (chainId 11155111)  
**Status:** Draft pending objective mainnet execution evidence

> Evidence gate: this file must not be published as final until every placeholder below is replaced with Ethereum mainnet tx hashes, blocks, explorer links, and verification outputs.

---

## Executive Summary

Aetheron Sentinel L3 mainnet deployment has not been evidenced in this repository yet. The current address table and operational notes below still reference the completed Sepolia rehearsal deployment and exist only as a draft structure for the final mainnet release packet.

**Release condition:** 100% of privileged paths must terminate at the owner EOA, multisig, or explicitly approved service accounts, and every claim below must be backed by mainnet explorer links plus archived verification outputs.

---

## Deployment Procedure

1. Validate all environment variables and secrets (.env)
2. Run deployment scripts as per [MAINNET_PREPARATION_TEMPLATE.md](./MAINNET_PREPARATION_TEMPLATE.md)
3. Execute contract deployments and record all addresses and transaction hashes
4. Transfer ownership and roles as per checklist
5. Run verification and audit scripts
6. Sync The Graph subgraph and monitor contract events
7. Update all documentation and publish release notes

Operator references:

- Use [docs/MAINNET_OPERATOR_RUNBOOK.md](./docs/MAINNET_OPERATOR_RUNBOOK.md) for the exact live execution order and command lines.
- Use [docs/MAINNET_RELEASE_PR_CHECKLIST.md](./docs/MAINNET_RELEASE_PR_CHECKLIST.md) while filling the release PR during deployment.
- Use [docs/MAINNET_EVIDENCE_CHECKLIST.md](./docs/MAINNET_EVIDENCE_CHECKLIST.md) for the final evidence packet.

---

## Deployment Addresses (Mainnet)

Explorer base URL: `https://etherscan.io/address`

> Draft only: these rows currently mirror the Sepolia rehearsal addresses from [site/contracts.js](./site/contracts.js). Replace them with Ethereum mainnet addresses and explorer links before release.

| Contract                       | Address                                      | Explorer                                                                                     |
| ------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| SentinelToken                  | `0xFf21fF20B61469075A2b2280724E9D99dA7e06Ed` | [Etherscan](https://sepolia.etherscan.io/address/0xFf21fF20B61469075A2b2280724E9D99dA7e06Ed) |
| AetheronBridge                 | `0x77E4C1EbeAB0c5140dd0F3d60eBf523134DC7597` | [Etherscan](https://sepolia.etherscan.io/address/0x77E4C1EbeAB0c5140dd0F3d60eBf523134DC7597) |
| SentinelInterceptor            | `0x057c15fA83A008ba65A20b6e0dE91949Ab987954` | [Etherscan](https://sepolia.etherscan.io/address/0x057c15fA83A008ba65A20b6e0dE91949Ab987954) |
| CircuitBreaker                 | `0x1FC97c1C54914E9053EDF97C390bF9b3b77eA885` | [Etherscan](https://sepolia.etherscan.io/address/0x1FC97c1C54914E9053EDF97C390bF9b3b77eA885) |
| RateLimiter                    | `0xA084B67baDC91Dd6d8cEec65af73c4F21337A888` | [Etherscan](https://sepolia.etherscan.io/address/0xA084B67baDC91Dd6d8cEec65af73c4F21337A888) |
| SentinelQuantumGuard           | `0x5a13Ea0B936AE6F58c84188c097f7974f0403297` | [Etherscan](https://sepolia.etherscan.io/address/0x5a13Ea0B936AE6F58c84188c097f7974f0403297) |
| SentinelMultiSigVault          | `0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994` | [Etherscan](https://sepolia.etherscan.io/address/0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994) |
| SentinelOracleNetwork          | `0x004B5b6a2d62b7734D0Ba9138716fd4fD22d4B3F` | [Etherscan](https://sepolia.etherscan.io/address/0x004B5b6a2d62b7734D0Ba9138716fd4fD22d4B3F) |
| SentinelSecurityAuditor        | `0x51Fd0DABd023Ab13090538C0751243E09ec87e2F` | [Etherscan](https://sepolia.etherscan.io/address/0x51Fd0DABd023Ab13090538C0751243E09ec87e2F) |
| SentinelMonitor                | `0xc7B0363540e9d141A07e8FE5F811c4726c50750c` | [Etherscan](https://sepolia.etherscan.io/address/0xc7B0363540e9d141A07e8FE5F811c4726c50750c) |
| SentinelYieldMaximizer         | `0x4eDB9BDF6A58c886CC9FE3D125CDbdF837c19df0` | [Etherscan](https://sepolia.etherscan.io/address/0x4eDB9BDF6A58c886CC9FE3D125CDbdF837c19df0) |
| SentinelStaking                | `0x1fADa3493E662F0aDDDb84259ee30b97C6A015E3` | [Etherscan](https://sepolia.etherscan.io/address/0x1fADa3493E662F0aDDDb84259ee30b97C6A015E3) |
| SentinelReferralSystem         | `0x86f9a5eBbE2f87Ff829b30702Ae43d2F409E97a8` | [Etherscan](https://sepolia.etherscan.io/address/0x86f9a5eBbE2f87Ff829b30702Ae43d2F409E97a8) |
| SentinelTimelock               | `0x670F79bFe0829e491aB0c41A7A93B1E56a09f2a0` | [Etherscan](https://sepolia.etherscan.io/address/0x670F79bFe0829e491aB0c41A7A93B1E56a09f2a0) |
| SentinelGovernance             | `0x38427f04abD2a9D938674a41c6dbf592E6e953f0` | [Etherscan](https://sepolia.etherscan.io/address/0x38427f04abD2a9D938674a41c6dbf592E6e953f0) |
| SentinelCore                   | `0x5C85D36529D1217189faf9E48C956d51e5de6211` | [Etherscan](https://sepolia.etherscan.io/address/0x5C85D36529D1217189faf9E48C956d51e5de6211) |
| SentinelCoreLoop               | `0x531dfa55456a39C8c3223c87062E209D1b831378` | [Etherscan](https://sepolia.etherscan.io/address/0x531dfa55456a39C8c3223c87062E209D1b831378) |
| SentinelAMM                    | `0xF0a2bA5F5c24Ef8ffd1Da6B4c383b90430d22573` | [Etherscan](https://sepolia.etherscan.io/address/0xF0a2bA5F5c24Ef8ffd1Da6B4c383b90430d22573) |
| SentinelPredictiveThreatModel  | `0xD023194d8f3Cf98197bDBC4252cAA19B2BdF7Db9` | [Etherscan](https://sepolia.etherscan.io/address/0xD023194d8f3Cf98197bDBC4252cAA19B2BdF7Db9) |
| SentinelHomomorphicEncryption  | `0x8E245764e99695aDA58c64911feA6BCd827762DF` | [Etherscan](https://sepolia.etherscan.io/address/0x8E245764e99695aDA58c64911feA6BCd827762DF) |
| SentinelQuantumKeyDistribution | `0x85Ac8C3f21bC7DE5a0aa5e73fCE14349220605E0` | [Etherscan](https://sepolia.etherscan.io/address/0x85Ac8C3f21bC7DE5a0aa5e73fCE14349220605E0) |
| SentinelQuantumNeural          | `0x9B02e12f164D76f94b880a9027351bE169886B0F` | [Etherscan](https://sepolia.etherscan.io/address/0x9B02e12f164D76f94b880a9027351bE169886B0F) |
| SentinelZKIdentity             | `0x67035285fefF86926CC83D8a214946B5A73EA21C` | [Etherscan](https://sepolia.etherscan.io/address/0x67035285fefF86926CC83D8a214946B5A73EA21C) |
| SentinelSocialRecovery         | `0xf1af2268aD0573916760acaB9F6FcaDF79220FC4` | [Etherscan](https://sepolia.etherscan.io/address/0xf1af2268aD0573916760acaB9F6FcaDF79220FC4) |
| SentinelZKOracle               | `0xcC3327F247de53eb10318b91656531D7D9a37387` | [Etherscan](https://sepolia.etherscan.io/address/0xcC3327F247de53eb10318b91656531D7D9a37387) |
| SentinelInsuranceProtocol      | `0x7390eA256FF5e113508a1AC4F2A2Ccbdd3C494D2` | [Etherscan](https://sepolia.etherscan.io/address/0x7390eA256FF5e113508a1AC4F2A2Ccbdd3C494D2) |

---

## Key Transactions

- Ownership handoff: Pending mainnet execution evidence
- Timelock role grants: Pending mainnet execution evidence
- Relayer enablement: Pending mainnet execution evidence

---

## Verification Checklist

- [ ] `npm run mainnet:preflight` passes and output is archived
- [ ] `npm run deploy:mainnet` has been executed on Ethereum mainnet
- [ ] `npm run setup:ownership -- --network mainnet` or equivalent multisig actions are complete
- [ ] `npm run setup:verify-tooling` and `npm run verify:mainnet` have completed
- [ ] All mainnet tx hashes, blocks, and explorer links have been inserted below
- [ ] All read-only audit scripts pass against mainnet addresses
- [ ] Subgraph is deployed and indexing the actual mainnet start block
- [ ] [site/contracts.js](./site/contracts.js) has been regenerated with mainnet explorer links
- [ ] [docs/MAINNET_RELEASE_PR_CHECKLIST.md](./docs/MAINNET_RELEASE_PR_CHECKLIST.md) is filled in and attached to the release PR
- [ ] [docs/MAINNET_EVIDENCE_CHECKLIST.md](./docs/MAINNET_EVIDENCE_CHECKLIST.md) is fully completed

---

## Next Steps

1. Run `npm run mainnet:preflight` and store the output in the release evidence pack.
2. Execute `npm run deploy:mainnet` and persist the emitted `DEPLOYED_ADDRESSES` JSON.
3. Complete ownership handoff, relayer enablement, and any Safe-based role transitions.
4. Run `npm run setup:verify-tooling`, `npm run verify:mainnet`, and the read-only audit scripts.
5. Regenerate [site/contracts.js](./site/contracts.js), update subgraph start blocks, and finalize this file.

---

## Known Issues & Mitigations

- None at this time. All known issues from testnet have been resolved. Any issues discovered during the dry run will be documented here with mitigations.

---

## References

---

## Risk Assessment & Mitigations

**Key Mainnet Risks:**

- Smart contract vulnerabilities (mitigated by audit, test coverage, and bug bounty)
- Key compromise or mismanagement (mitigated by multisig, hardware wallets, and strict access controls)
- Governance or role misconfiguration (mitigated by checklist and verification scripts)
- Subgraph or monitoring failure (mitigated by redundant endpoints and alerting)
- Unexpected mainnet gas spikes (mitigated by pre-funding and gas monitoring)

**Mitigations:**

- All contracts audited and fuzz tested
- All privileged actions require multisig
- Emergency pause/upgrade/rollback scripts prepared
- Real-time monitoring and alerting in place

---

## Timeline & Milestones

| Milestone              | Date/Window              | Status           |
| ---------------------- | ------------------------ | ---------------- |
| Code freeze            | 2026-04-20               | Complete         |
| Final audit review     | 2026-04-22               | Complete         |
| Mainnet preflight      | Next run                 | Pending evidence |
| Go/No-Go checkpoint    | After preflight + review | Pending          |
| Mainnet deployment     | After go/no-go           | Not executed     |
| Post-deploy monitoring | After deployment         | Not started      |

---

## Rollback Plan

1. Immediately pause affected contracts (if possible)
2. Notify all stakeholders and multisig signers
3. Revoke compromised roles/keys via multisig
4. Execute emergency scripts to revert to last known good state
5. Communicate status and next steps to the community
6. Resume operations only after full incident review

---

## Monitoring & Alerting

- **Dashboards:** Grafana (mainnet), Etherscan, The Graph Explorer
- **Alert Channels:** PagerDuty, Discord #alerts, email on-call rotation
- **On-Call Rotation:** 24/7 coverage for first 72h post-launch, then standard ops
- **Automated Checks:** Contract event triggers, subgraph sync, relayer health

---

## Change Log

- All contract code and scripts updated since Sepolia deployment
- Security audit findings addressed
- Improved secret management and .env validation
- Enhanced monitoring and alerting integrations
- Documentation and onboarding updated for mainnet

---

## Appendix

- [Etherscan Mainnet](https://etherscan.io/)
- [The Graph Explorer](https://thegraph.com/explorer)
- [Grafana Dashboard](https://grafana.example.com/)
- [Discord](https://discord.gg/aetheron)
- [Project Website](https://aetheron.io/)

- [DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md](./DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md)
- [DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md)
- [MAINNET_PREPARATION_TEMPLATE.md](./MAINNET_PREPARATION_TEMPLATE.md)
- [DEPLOYMENT_OWNERSHIP_CHECKLIST.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md)
- [SECURITY_AUDIT_CERTIFICATION.md](./SECURITY_AUDIT_CERTIFICATION.md)
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
- [site/contracts.js](./site/contracts.js)

_Draft file. Finalize only after Ethereum mainnet deployment is executed and all placeholders are replaced with objective evidence._

---

## Critical Security Handoffs (Planned)

### 1. Timelock Admin Role Transfer

**Objective:** Hand ownership control to multisig while revoking deployer admin access.

| #   | Action                                      | Target   | Tx Hash | Block | Status |
| --- | ------------------------------------------- | -------- | ------- | ----- | ------ |
| 0   | `grantRole(TIMELOCK_ADMIN_ROLE, multisig)`  | Timelock | [TBD]   | [TBD] | ⏳     |
| 1   | `grantRole(PROPOSER_ROLE, multisig)`        | Timelock | [TBD]   | [TBD] | ⏳     |
| 2   | `grantRole(CANCELLER_ROLE, multisig)`       | Timelock | [TBD]   | [TBD] | ⏳     |
| 3   | `revokeRole(TIMELOCK_ADMIN_ROLE, ownerEOA)` | Timelock | [TBD]   | [TBD] | ⏳     |

**Break-glass recovery:** Owner EOA retains `PROPOSER_ROLE` and `CANCELLER_ROLE` as an emergency rollback path. Revoke via multisig when production lock-down is required.

### 2. Bridge Relayer Enablement

**Objective:** Enable owner EOA to sign and relay bridge transfers.

- **Action**: `AetheronBridge.setRelayer([mainnet relayer address], true)`
- **Tx Hash**: [TBD]
- **Block**: [TBD]
- **Status**: ⏳ Pending

### 3. CoreLoop Optional Component Wiring

**Objective:** Wire optional security/staking components that are already deployed.

| Component       | Address | Tx Hash | Block | Status |
| --------------- | ------- | ------- | ----- | ------ |
| multiSigVault   | [TBD]   | [TBD]   | [TBD] | ⏳     |
| securityAuditor | [TBD]   | [TBD]   | [TBD] | ⏳     |
| stakingSystem   | [TBD]   | [TBD]   | [TBD] | ⏳     |

---

## Mainnet Dry Run Results

_Use this section to paste the archived output of `npm run mainnet:preflight` plus any additional dry-run or rehearsal evidence. No objective mainnet preflight output is published in this repo yet._

---

## Final Notes

- All operational and security procedures validated on testnet
- Mainnet deployment will follow the exact steps rehearsed
- This document must remain a draft until mainnet tx hashes, verification outputs, and explorer links are attached
