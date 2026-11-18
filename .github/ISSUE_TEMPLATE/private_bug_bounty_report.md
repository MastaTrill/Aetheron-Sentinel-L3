---
name: Private Bug Bounty Vulnerability Report
about: Submit a security finding for Aetheron Sentinel L3 (v0.2.1 Private Bug Bounty)
title: "[BOUNTY][SEVERITY] Brief description of invariant violation"
labels: ["security", "bug-bounty"]
assignees: []
---

## 1. Finding Metadata

- **Target Component:** (`interceptor.py` / `policy_pack.py` / `pq_backend.py` / `rpc_adapter.py` / `execution.py` / `SentinelInterceptor.sol` / `CircuitBreaker.sol` / `RateLimiter.sol`)
- **Claimed Severity:** (`Critical (P0)` / `High (P1)` / `Medium (P2)` / `Low (P3)`)
- **Invariant Violated:** (`INV-1` / `INV-2` / `INV-3` / `INV-4` / `INV-5`)
- **Tested Commit SHA / Tag:** (`v0.2.1` / `540aafa`)

---

## 2. Vulnerability Summary

Provide a clear 2–4 sentence summary of the vulnerability and which security guarantee it breaks.

---

## 3. Root Cause Analysis

Identify the exact file(s), function(s), and line range(s) responsible for the issue.

---

## 4. Deterministic Proof of Concept (PoC)

Provide either a JSON payload for `scripts/bug_bounty_repro_harness.py --poc poc.json` or a self-contained Python `unittest` reproduction:

```json
{
  "invariant": "INV-1",
  "expected_action": "BLOCK",
  "input": {
    "amount": 48000.0,
    "available_liquidity": 50000.0,
    "velocity_1h": 24000.0,
    "velocity_24h": 30000.0,
    "anomaly_score": 0.96,
    "signer_quorum_ratio": 0.45,
    "chain_id": "base-sepolia",
    "asset_symbol": "AETH",
    "event_id": "poc-1"
  }
}
```

### Observed Output vs. Expected Output
- **Observed:**
- **Expected:**

---

## 5. Impact Assessment & Proposed Remediation

Describe the blast radius under the production `conservative` profile and outline the recommended code fix.
