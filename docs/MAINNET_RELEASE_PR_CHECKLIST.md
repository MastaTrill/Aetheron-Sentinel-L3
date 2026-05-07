# Mainnet Release PR Checklist

Use this checklist in the release PR during the live deployment. Fill every placeholder with objective evidence.

## Summary

- [ ] Deployment scope and rationale described
- [ ] Target network confirmed as Ethereum mainnet
- [ ] Linked runbook: [docs/MAINNET_OPERATOR_RUNBOOK.md](./MAINNET_OPERATOR_RUNBOOK.md)

## Preflight Evidence

- [ ] `npm run mainnet:preflight` executed
- [ ] Output artifact attached: `logs/mainnet-preflight.txt`
- [ ] Chain ID observed: `1`
- [ ] Deployer address: `0x...`
- [ ] Final owner address: `0x...`

## Deployment Evidence

- [ ] `npm run deploy:mainnet` executed
- [ ] Deployment output artifact attached: `logs/mainnet-deploy.txt`
- [ ] `DEPLOYED_ADDRESSES` JSON captured in PR
- [ ] Earliest deployment block recorded: `__________`
- [ ] Contract address map pasted below:

```json
{
  "SentinelToken": "0x...",
  "AetheronBridge": "0x..."
}
```

## Ownership And Governance Evidence

- [ ] `npm run setup:ownership -- --network mainnet` completed, or equivalent Safe actions executed
- [ ] Ownership/setup output artifact attached: `logs/mainnet-ownership.txt`
- [ ] Timelock admin tx: `0x...`
- [ ] Proposer role tx: `0x...`
- [ ] Canceller role tx: `0x...`
- [ ] Admin revoke tx: `0x...`
- [ ] Safe transaction links attached when applicable

## Verification Evidence

- [ ] `npm run setup:verify-tooling` executed
- [ ] `npm run verify:mainnet` executed
- [ ] Verification output artifact attached: `logs/mainnet-verify.txt`
- [ ] Explorer links for verified contracts added to release notes

## Public Config And Subgraph Evidence

- [ ] [site/contracts.js](../site/contracts.js) regenerated with `window.SENTINEL_NETWORK = 'mainnet'`
- [ ] [site/contracts.js](../site/contracts.js) explorer URLs point to `https://etherscan.io/address/...`
- [ ] [subgraph.yaml](../subgraph.yaml) patched with mainnet addresses
- [ ] Mainnet start block recorded: `__________`

## Read-Only Audit Evidence

- [ ] `node scripts/section7-final-sweep.cjs` executed
- [ ] `node scripts/audit-allowlists.cjs` executed
- [ ] `node scripts/verify-bridge-relayers.cjs` executed
- [ ] Audit artifacts attached:
  - `logs/section7-final-sweep.txt`
  - `logs/audit-allowlists.txt`
  - `logs/verify-bridge-relayers.txt`
- [ ] No unknown privileged addresses found

## Release Documentation

- [ ] [docs/MAINNET_EVIDENCE_CHECKLIST.md](./MAINNET_EVIDENCE_CHECKLIST.md) completed
- [ ] [RELEASE_NOTES_MAINNET_2026-04-27.md](../RELEASE_NOTES_MAINNET_2026-04-27.md) updated with tx hashes, blocks, and explorer links
- [ ] [DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md](../DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md) updated with matching references
- [ ] [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md) still reflects actual state after deployment

## Sign-Off

- [ ] Code review complete
- [ ] Security review complete
- [ ] Ops/deployment review complete
- [ ] Stakeholder announcement approved
- [ ] Go-live approved
