# Mainnet Evidence Checklist

Before declaring mainnet complete, replace all placeholders with objective evidence.

## Ownership handoff evidence

- Contract:
- Transaction hash:
- Block number:
- Explorer URL:
- Previous owner:
- New owner:

## Timelock role transition evidence

- `grantRole(TIMELOCK_ADMIN_ROLE, multisig)` tx:
- `grantRole(PROPOSER_ROLE, multisig)` tx:
- `grantRole(CANCELLER_ROLE, multisig)` tx:
- `revokeRole(TIMELOCK_ADMIN_ROLE, ownerEOA)` tx:
- Role verification script output link:

## Relayer enablement evidence

- `AetheronBridge.setRelayer(relayer, true)` tx:
- Block number:
- Explorer URL:
- Post-check output link:

## External validation signal (at least one)

- Public dashboard URL:
- Verifiable contract list + source links:
- Third-party audit/attestation link:

## Publication checklist

- Update `RELEASE_NOTES_MAINNET_2026-04-27.md` with all final tx hashes and links.
- Update `DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md` with matching references.
- Attach workflow links and artifacts from CI proving deploy-time verification jobs.
