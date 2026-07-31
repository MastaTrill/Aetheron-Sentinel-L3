# SENTINEL Beneficiary Remediation Authorization (unsigned draft)

**Status: NOT AUTHORIZED**

This file is a human-readable companion to `authorization.json` and ADR-2026-07-29.
Null / placeholder fields do **not** authorize signing or broadcasting.
Never commit private keys, seed phrases, or wallet-session material.

Related issues: #215 (beneficiary remediation), parent #210  
Decision record: `docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md`  
Network: Base Mainnet (chainId `8453`)

---

## Route selection (owner must choose one)

| Route | Description | Prerequisite |
|-------|-------------|--------------|
| **A — live remediation** | `collectFees` then `updateBeneficiary` on the existing initializer/pool | Cryptographic **controller proof** for current 57% beneficiary `0x7e3D11f70084D667295710E6b7FF50C3b0487a45` |
| **B — replacement deployment** | New canonical deployment with treasury as 57% beneficiary from inception | ADR-2026-07-29 path; no claim of control over `0x7e3D…7a45` |

**Selected route:** `null`  
**Controller proof status (Route A only):** `missing`

Until Route A controller proof is verified, **Route B remains the fail-closed recommendation**.

---

## Canonical addresses (read-only reference)

| Field | Value |
|-------|-------|
| Initializer | `0xD59cE43E53D69F190E15d9822Fb4540dCcc91178` |
| Pool ID | `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d` |
| Current 57% beneficiary | `0x7e3D11f70084D667295710E6b7FF50C3b0487a45` |
| Intended treasury (57%) | `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` |

---

## Route A — execution order (only if controller proof verified)

1. `collectFees`
2. `updateBeneficiary` → treasury `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`

Exact calldata must match the pinned preflight / `authorization.json` transactions. No other calls are authorized.

---

## Owner-filled fields (required before any broadcast)

| Field | Value |
|-------|-------|
| Authorized by (legal name / handle) | `null` |
| Authorized at (UTC ISO-8601) | `null` |
| Expires at (UTC ISO-8601) | `null` |
| Selected route (A or B) | `null` |
| Maximum total gas cost (wei) | `null` |
| Approved pinned block | `null` |
| Approved preflight SHA-256 | `null` |
| Controller public message (Route A) | `null` |
| Controller public signature (Route A) | `null` |
| Verified signer (Route A) | `null` |
| Verified at UTC (Route A) | `null` |

---

## Authorization statement (copy when signing)

> I authorize only the route and exact transactions recorded in this file and the matching `authorization.json`, in the stated order, after independent review. No ownership, migration, minting, metadata, liquidity, beneficiary other than the 57% creator slot, or unrelated fee action is authorized. This authorization is void after the stated expiry.

**Signature / attestation reference:** `null`  
**Independent review status:** `missing`  
**Reviewer / signoff reference:** `null`

---

## Post-execution evidence

| Field | Value |
|-------|-------|
| collectFees tx hash (Route A) | `null` |
| updateBeneficiary tx hash (Route A) | `null` |
| Replacement deployment tx / manifest (Route B) | `null` |

Preflight helper (does not broadcast):

```bash
node scripts/prepare-sentinel-beneficiary-remediation.mjs
```

---

## Notice

- This draft remains **fail-closed** until route selection, required fields, and a verifiable owner signature are present.
- Assistant-generated content is never a substitute for owner authorization or controller proof.
- Matching machine-readable file: `release-evidence/sentinel-mainnet/beneficiary-remediation/authorization.json`
