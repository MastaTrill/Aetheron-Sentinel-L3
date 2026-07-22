# Production release core

The only production deployment profile currently permitted by this repository is
`sentinel-guardrails-v1`, defined in `config/release-core.json`.

## Included

- `SentinelInterceptor`
- `CircuitBreaker`
- `RateLimiter`

These contracts are deployed by an ephemeral signer, configured with the explicit
monitor allowlist, paused, and then transferred to a separate owner. The deployer
must retain no ownership, admin, operator, or monitor role. The deployment manifest
records constructor arguments, transactions, blocks, and runtime bytecode hashes.

## Excluded

Custody, bridge settlement, insurance, yield, AI execution, and simulated ZK or
quantum-security modules are not part of this production profile. Their presence in
the repository does not imply production approval.

Legacy full-suite and one-command mainnet entry points are intentionally disabled.

## Mandatory gates

1. Protect the `base-sepolia` and `base-mainnet` GitHub environments with required
   reviewers and deployment-branch restrictions.
2. Use separate ephemeral deployer, Safe/timelock owner, and monitor addresses.
3. Broadcast the exact reviewed commit through the Base Sepolia workflow, retain
   its successful deployment artifact, and supply that workflow run ID to the
   mainnet workflow. Mainnet verifies that the artifact reached `verified-paused`
   and records its SHA-256 digest.
4. Enable GitHub release immutability, publish a non-prerelease for the exact
   release commit, and supply its tag to the mainnet workflow. A plain mutable Git
   tag is not sufficient.
5. Complete an independent audit of the exact release commit and configure its
   SHA-256 digest as `AUDIT_REPORT_SHA256`.
6. Run the mainnet workflow in readiness-only mode and retain its evidence.
7. Broadcast only after an independent go/no-go review.
8. Confirm the generated manifest reaches `verified-paused` and source verification
   succeeds before any Safe unpause or permission expansion.

No workflow in this repository authorizes adding custody, enabling an asset, or
unpausing production. Those actions require a separately reviewed Safe/timelock
proposal.
