# Sentinel L3 Launch Evidence Pack — 2026-04-27

This pack turns the remaining launch gates into concrete evidence requirements. Keep this file linked from the launch tracker and append dated artifacts as they are generated.

## Gate status

| Gate                          | Status                   | Required evidence                                                                                                              | Owner action                                              |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 7-day Sepolia evidence window | Pending evidence         | 7 dated folders under `logs/verification/`, daily tx hashes, failures, indexing latency, relayer behavior, and stability notes | Run daily validation and commit/export logs               |
| Subgraph/dashboard visibility | Pending verification     | Subgraph latest indexed block, entity counts, dashboard screenshots/exports, indexed-at timestamps, visible-at timestamps      | Capture proof after each traffic session                  |
| Relayer + governance lockdown | Pending proof            | Relayer signer set, multisig/timelock addresses, owner separation proof, break-glass removal tx hash                           | Execute role checks and transfer/revoke actions if needed |
| Mainnet signoff checklist     | Blocked until gates pass | Validation summary, monitoring proof, security review, stakeholder approval                                                    | Collect approvals after Sepolia window passes             |
| Controlled rollout            | Blocked until signoff    | Release notes, address map, verification links, bridge activation txs, governance-approved limits                              | Execute only after all prior gates are green              |

## Daily Sepolia evidence template

Create `logs/verification/YYYY-MM-DD/DAILY_NOTES.md` with this content for each day.

```md
# Sentinel L3 Sepolia Daily Notes — YYYY-MM-DD

## Summary

- Run date:
- Operator:
- Environment:
- Deployment/version/commit:
- Overall result: PASS / FAIL / PARTIAL

## Transactions

| UTC time | Action                   | Tx hash | Contract | Result | Gas used | Confirmations | Notes |
| -------- | ------------------------ | ------- | -------- | ------ | -------: | ------------: | ----- |
|          | Bridge transfer          |         |          |        |          |               |       |
|          | Governance/timelock flow |         |          |        |          |               |       |
|          | Staking/CoreLoop path    |         |          |        |          |               |       |

## Failures / anomalies

| UTC time | Component | Severity | Symptom | Tx hash/log link | Root cause | Remediation | Status |
| -------- | --------- | -------- | ------- | ---------------- | ---------- | ----------- | ------ |
|          |           |          |         |                  |            |             |        |

## Indexing latency

| Tx hash/event | Block | Event emitted at | Subgraph indexed at | Dashboard visible at | Index latency | UI latency | Notes |
| ------------- | ----: | ---------------- | ------------------- | -------------------- | ------------: | ---------: | ----- |
|               |       |                  |                     |                      |               |            |       |

## Relayer behavior

| Relayer address | Expected role | Observed action | Last seen | Success count | Failure count | Notes |
| --------------- | ------------- | --------------- | --------- | ------------: | ------------: | ----- |
|                 |               |                 |           |               |               |       |

## Stability data

| Metric                         | Value | Evidence link                |
| ------------------------------ | ----: | ---------------------------- |
| Section 7 sweep pass/fail      |       | `section7-final-sweep.log`   |
| Allowlist audit pass/fail      |       | `audit-allowlists.log`       |
| Relayer verification pass/fail |       | `verify-bridge-relayers.log` |
| Subgraph latest indexed block  |       |                              |
| Dashboard data freshness       |       |                              |
```

## Subgraph/dashboard verification checklist

- [ ] Latest subgraph indexed block recorded
- [ ] Required entities visible and nonzero
- [ ] Latest bridge transfer appears in subgraph
- [ ] Latest governance/timelock action appears in subgraph or indexed logs
- [ ] Latest staking/CoreLoop action appears in dashboard
- [ ] Dashboard timestamp is current after traffic session
- [ ] Screenshot/export saved with date and commit

## Relayer + governance lockdown checklist

- [ ] Relayer signer list matches approved signer set
- [ ] Owner EOA is not acting as relayer
- [ ] Owner EOA is not the final governance authority
- [ ] Multisig/timelock address recorded for every controlled contract
- [ ] Break-glass/emergency owner powers removed, disabled, or explicitly scoped
- [ ] Any revocation/transfer transaction hash recorded
- [ ] Post-change role audit passes

## Mainnet signoff template

```md
# Mainnet Signoff — Sentinel L3

## Validation

- Sepolia evidence window: PASS / FAIL
- Subgraph/dashboard verification: PASS / FAIL
- Relayer/governance lockdown: PASS / FAIL
- Open blockers:

## Monitoring

- Dashboard URL:
- Alert destinations:
- On-call owner:
- Rollback/escalation path:

## Security review

- Reviewer:
- Scope:
- Result:
- Exceptions accepted:

## Stakeholder approval

| Approver | Role | Decision           | Date | Notes |
| -------- | ---- | ------------------ | ---- | ----- |
|          |      | APPROVED / BLOCKED |      |       |
```

## Controlled rollout checklist

- [ ] Release notes published
- [ ] Mainnet address map published
- [ ] Explorer verification links published
- [ ] Bridge activation transaction recorded
- [ ] Governance-approved bridge limits recorded
- [ ] Monitoring checked for first activation window
- [ ] Incident/rollback path confirmed

## Current known blockers

- Live wallet/RPC/dashboard access is required to complete validation transactions and telemetry capture.
- Third-party or hosted dashboard access is required to prove subgraph/dashboard visibility.
- Governance/multisig execution access is required to transfer/revoke roles and remove break-glass privileges.
