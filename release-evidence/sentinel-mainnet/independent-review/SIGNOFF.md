# Independent Review Sign-off (unsigned draft)

**Status: NOT AUTHORIZED / REVIEW PENDING**

Companion to `signoff.json` and `REVIEW_REQUEST.md`.  
This template does **not** constitute a completed independent review.

Related issues: #217 (independent review), parent #210

---

## Independence requirements

The reviewer must **not** be:

- the project owner
- a beneficiary or controller of the 57% creator slot
- the smoke-test operator
- the author of the release-evidence package
- the assistant that prepared drafts

Disclose any compensation, prior relationship, or conflict.

---

## Reviewer fields (fill only by the independent reviewer)

| Field | Value |
|-------|-------|
| Reviewer name | `null` |
| Organization (if any) | `null` |
| Contact | `null` |
| Independence statement | `null` |
| Reviewed commit (full SHA) | `null` |
| Reviewed at (UTC ISO-8601) | `null` |
| Decision | `null` (`approve` / `approve-with-conditions` / `reject`) |
| Signature / public attestation reference | `null` |

---

## Methods & evidence reviewed

- Methods used: `[]`
- Evidence paths reviewed: `[]`
- Findings: `[]`
- Unresolved risks: `[]`

Minimum evidence tree to cover independently:

- `release-evidence/sentinel-mainnet/authority-reachability.txt`
- `release-evidence/sentinel-mainnet/beneficiary-audit/`
- `release-evidence/sentinel-mainnet/beneficiary-remediation/`
- `release-evidence/sentinel-mainnet/second-rpc/`
- `release-evidence/sentinel-mainnet/smoke-test/`
- `release-evidence/sentinel-mainnet/swaps-decoded/`
- `release-evidence/sentinel-mainnet/release-closure.json`
- `docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md`

---

## Notice

Only an unconditional **approve** from a verified independent reviewer can satisfy the final-release independent-review gate.  
Matching machine-readable file: `release-evidence/sentinel-mainnet/independent-review/signoff.json`
