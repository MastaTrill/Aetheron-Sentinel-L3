# Independent SENTINEL Release Review Request

> **Superseded review scope:** This request covers the legacy deployment and is retained for audit history only. Replacement approval must use `docs/SENTINEL_INDEPENDENT_REVIEW_PACKET.md` and `release-evidence/sentinel-mainnet/redeployment-closure.json`.

- Repository: `MastaTrill/Aetheron-Sentinel-L3`
- Review gate: issue #217
- Beneficiary blocker: issue #215
- Smoke-test gate: issue #216
- Review target: the exact commit identified by the reviewer at the start of review
- Current conclusion: **not release-approved**

## Reviewer independence

The reviewer must not be the project owner, a beneficiary/controller, the smoke-test wallet operator, the author of the reviewed evidence, or the assistant that prepared the release package. The reviewer should have demonstrated smart-contract security experience, including EVM bytecode/source verification and Uniswap V4 or comparable AMM review experience.

The reviewer must disclose conflicts, compensation, and any prior contribution to this repository.

## Required reproduction

The reviewer must independently reproduce, not merely read screenshots of:

1. Chain ID, canonical token, PoolManager, pool ID, token ordering, hooks, fee/tick configuration, and current pool state.
2. Exact verified source and runtime-bytecode mapping at every material deployed address.
3. Owner, beneficiary, fee, migration, mint/metadata, emergency-control, and authority reachability.
4. The 57% beneficiary state and the absence or presence of cryptographic controller proof.
5. The chosen resolution under ADR `docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md`.
6. Two independent RPC reproductions with block numbers, response hashes, and provider identifiers.
7. The separately authorized WETH→SENTINEL and SENTINEL→WETH receipts, including sender, pool direction, status, principal, gas, and slippage bounds.
8. CI, compiler, dependency, static-analysis, test, and release-validator results for the exact reviewed commit.

## Required deliverable

Create `signoff.md` in this directory containing:

- reviewer name or organization;
- reviewer qualifications and public verification reference;
- independence/conflict statement;
- exact reviewed commit SHA;
- exact deployment/redeployment manifest checksum;
- reproduced chain state and RPC evidence;
- findings classified by severity;
- unresolved governance, economic, operational, and centralization risks;
- remediation verification;
- conclusion: `approve`, `approve with conditions`, or `reject`;
- a verifiable public signature, signed commit, or equivalent approval reference.

A generic approval, unsigned checklist, screenshot-only review, project-owner self-review, or review that does not reference the exact commit is insufficient.

## Release rule

No release approval may be recorded until issue #215 is resolved on-chain or by an approved replacement deployment, issue #216 contains verified buy/sell receipts, and the independent reviewer signs the exact final evidence commit.
