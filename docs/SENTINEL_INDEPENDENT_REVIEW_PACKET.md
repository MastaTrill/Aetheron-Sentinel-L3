# SENTINEL independent release review packet

An independent reviewer must not be the person who prepared or merged the evidence. The reviewer should reproduce the critical reads and sign the final decision without access to any production private key.

## Review scope

1. Confirm the reviewed commit and exact replacement deployment manifest.
2. Confirm the replacement source, compiler, optimizer, bytecode, initializer inputs, owner, and emergency controls.
3. Confirm the replacement 57% Creator beneficiary is `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` from inception.
4. Reproduce the protected Base Sepolia rehearsal and compare its manifest and digests.
5. After separately authorized deployment, reproduce the replacement token, pool, initializer, beneficiary shares, and receipts through two independent Base RPC providers.
6. Confirm the legacy token, pool, and `0x7e3D...7a45` beneficiary remain labeled legacy/non-canonical and are not represented as Aetheron-controlled.
7. Validate the separately authorized replacement buy and sell receipts against the replacement pool.
8. Review the controlled-redeployment decision and every residual risk.
9. Check `release-evidence/sentinel-mainnet/redeployment-closure.json` and every referenced digest in final mode.

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
