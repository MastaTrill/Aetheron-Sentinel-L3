# SENTINEL independent release review packet

An independent reviewer must not be the person who prepared or merged the evidence. The reviewer should reproduce the critical reads and sign the final decision without access to any production private key.

## Review scope

1. Confirm canonical token, chain ID, runtime hashes, and pinned block evidence.
2. Confirm exact source mapping for the Airlock, NoOp migrator, initializer, hook, and PoolManager.
3. Review `docs/SENTINEL_AUTHORITY_REACHABILITY.md` against the verified ABIs and source.
4. Re-run both RPC verification scripts using a third provider or independently operated node.
5. Re-run decoded historical swap collection and compare counts, directions, entrypoints, and transaction hashes.
6. Validate all four beneficiary attestations cryptographically.
7. Validate the authorized buy and sell receipts using `scripts/verify-sentinel-smoke-test.mjs`.
8. Review the conditional architecture decision and every residual risk.
9. Check the final release manifest and file digests.

## Required sign-off

The reviewer must add a signed record containing:

- reviewer name or organization;
- professional contact or verifiable public identity;
- scope and evidence commit reviewed;
- findings by severity;
- unresolved risks;
- explicit approve/reject decision;
- UTC timestamp;
- detached signature or signed Git commit/tag.

A green CI run is supporting evidence, not independent approval. Issue #210 remains open until this record and the final immutable evidence digest are merged.
