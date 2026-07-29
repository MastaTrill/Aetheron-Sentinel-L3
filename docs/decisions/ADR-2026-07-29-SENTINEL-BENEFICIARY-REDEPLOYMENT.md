# ADR: SENTINEL Beneficiary Remediation by Controlled Redeployment

- Date: 2026-07-29
- Status: Approved for preparation only
- Release authority: Project owner
- Related issues: #210, #215, #216, #217

## Decision

The current Base Mainnet SENTINEL deployment must remain non-canonical for release purposes unless cryptographic proof is produced that the current 57% beneficiary can execute the reviewed `collectFees` and `updateBeneficiary` sequence.

Because that controller proof is presently missing, the approved fail-closed path is to prepare a replacement canonical deployment with the established Aetheron treasury configured as the 57% beneficiary from inception:

`0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`

This decision authorizes planning, reproducible simulations, evidence generation, and independent review. It does **not** authorize a Base Mainnet broadcast, wallet signing, liquidity movement, fee collection, token migration, public trading, or acceptance of public funds.

## Mandatory deployment gates

1. Pin the exact source commit, compiler, optimizer, constructor/initializer inputs, deployment bytecode, and expected runtime bytecode.
2. Produce a Base Sepolia rehearsal using the intended owner, treasury, beneficiary weights, PoolManager, and release workflow.
3. Prove through two independent RPC providers that the replacement configuration assigns the 57% share to the Aetheron treasury.
4. Reproduce ownership, beneficiary, fee, migration, and emergency-control reachability from chain state rather than screenshots.
5. Obtain an independent qualified review referencing the exact reviewed commit and deployment manifest.
6. Obtain a separate explicit transaction authorization before any Base Mainnet deployment or funding transaction.
7. Preserve deployment, verification, pool-creation, liquidity, buy, and sell receipts in the immutable release-evidence package.

## Legacy deployment treatment

Until all gates pass, the existing SENTINEL token/pool and its current 57% beneficiary must be labeled legacy/non-canonical in release materials. No document may imply that the Aetheron treasury controls that existing beneficiary without valid cryptographic and on-chain proof.

If valid controller proof becomes available before replacement deployment authorization, issue #215 may reassess the in-place remediation route. Preparation of the replacement path does not itself authorize either route to be broadcast.

## Acceptance criteria

The redeployment path becomes release-approved only when:

- the exact replacement deployment manifest has passed CI;
- the intended 57% treasury beneficiary is reproduced through two RPC providers;
- the reviewer signs off on the exact commit and manifest;
- a dedicated non-privileged wallet completes the separately authorized WETH→SENTINEL and SENTINEL→WETH smoke test;
- the final release validator exits zero; and
- the project owner separately authorizes the Base Mainnet broadcast with explicit limits and expiry.
