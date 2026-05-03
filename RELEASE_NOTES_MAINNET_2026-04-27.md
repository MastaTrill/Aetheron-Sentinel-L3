# Aetheron Sentinel L3 Mainnet Deployment — Release Notes

**Date:** 2026-04-27  
**Network:** Ethereum Mainnet (chainId 1)  
**Status:** ⏳ Pending mainnet dry run

> Evidence gate: do not mark this release complete until every item in [docs/MAINNET_EVIDENCE_CHECKLIST.md](./docs/MAINNET_EVIDENCE_CHECKLIST.md) is filled with concrete tx hashes, block numbers, and explorer URLs.

---

## Executive Summary

Aetheron Sentinel L3 is ready for mainnet deployment. All security, governance, and operational controls have been validated on Sepolia and rehearsed for mainnet. This document will be updated with final contract addresses, block numbers, and transaction hashes after the dry run and actual deployment.

**Key achievement:** 100% of privileged paths will terminate at the owner EOA, multisig, or explicitly approved service accounts. No temporary deployer roles will remain after deployment.

---

## Deployment Procedure

1. Validate all environment variables and secrets (.env)
2. Run deployment scripts as per [MAINNET_PREPARATION_TEMPLATE.md](./MAINNET_PREPARATION_TEMPLATE.md)
3. Execute contract deployments and record all addresses and transaction hashes
4. Transfer ownership and roles as per checklist
5. Run verification and audit scripts
6. Sync The Graph subgraph and monitor contract events
7. Update all documentation and publish release notes

---

## Deployment Addresses (Mainnet)

Mainnet addresses and Etherscan links must be attached here after deployment.  
Current `site/contracts.js` is Sepolia-scoped (`window.SENTINEL_NETWORK = 'sepolia'`) and is **not** a mainnet evidence source.

---

## Key Transactions

- Ownership handoff: Pending (to be executed via Safe UI or setup script)
- Timelock role grants: Pending (see DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md)
- Relayer enablement: Pending (see MAINNET_PREPARATION_TEMPLATE.md)

---

## Verification Checklist

- [ ] All 20 Ownable contracts have correct mainnet owner
- [ ] Timelock admin/proposer/canceller roles assigned to multisig
- [ ] Relayer enabled and verified
- [ ] All allowlists audited (no unknown addresses)
- [ ] Subgraph deployed and indexing mainnet events
- [ ] All verification scripts pass
- [ ] All documentation and configs reference mainnet addresses

---

## Next Steps

1. Complete ownership and governance handoff
2. Run all verification scripts on mainnet
3. Monitor The Graph and Etherscan for contract events
4. Attach all verification outputs to release PR
5. Require code and security review signoff before go-live

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

| Milestone              | Date/Window          | Status   |
| ---------------------- | -------------------- | -------- |
| Code freeze            | 2026-04-20           | Complete |
| Final audit review     | 2026-04-22           | Complete |
| Mainnet dry run        | 2026-04-27           | Pending  |
| Go/No-Go checkpoint    | 2026-04-28 09:00 UTC | Pending  |
| Mainnet deployment     | 2026-04-28 12:00 UTC | Pending  |
| Post-deploy monitoring | 2026-04-28+          | Planned  |

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

_To be filled after mainnet deployment. Use the Sepolia format as a template, updating all addresses and Etherscan links for mainnet._

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

_This section will be updated after the mainnet dry run. Include all simulated contract addresses, block numbers, and any issues or lessons learned._

---

## Final Notes

- All operational and security procedures validated on testnet
- Mainnet deployment will follow the exact steps rehearsed
- This document will be finalized after the mainnet dry run and actual deployment
