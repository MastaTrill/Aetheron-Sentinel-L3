# Private Bug Bounty Scope & Rules — Aetheron Sentinel L3 (`v0.2.1`)

## 1. Program Overview & Blast-Radius Controls
Aetheron Sentinel L3 (`v0.2.1`) launches in **Private Bug Bounty** mode following completion of two clean staging windows (`staging-window-1` and `staging-window-2`).
- **Active Profile:** `conservative` (`throttle_threshold = 0.35`, `block_threshold = 0.60`, `max_hourly_drain_ratio = 0.25`, `max_global_hourly_drain_ratio = 0.35`, `max_actor_hourly_drain_ratio = 0.15`)
- **Cryptographic Enforcement:** Dual-signed policy packs (`hmac-sha256` + `pq-ext` via `RealDilithiumBackend` / `dilithium_py` `Dilithium2`) with `grace_days_remaining = 0`.
- **Kill-Switch SLA:** $\le 5$ minutes via `SentinelInterceptor.engage_kill_switch()` and on-chain `Sentinel.pause()` / `L3Relay.pause()`.

---

## 2. In-Scope Targets

| Target | Path / Location | Scope Focus |
| :--- | :--- | :--- |
| **Risk Engine & Interceptor** | `src/aetheron_sentinel_l3/interceptor.py` | Circuit breaker bypass, idempotency replay bypass, kill-switch bypass, threshold override manipulation |
| **Post-Quantum Policy Packs** | `src/aetheron_sentinel_l3/policy_pack.py`, `pq_backend.py` | Signature forgery, downgrade attacks (`pq-ext` $\rightarrow$ `hmac-sha256`), unauthorized policy rollback |
| **JSON-RPC Execution Adapter** | `src/aetheron_sentinel_l3/rpc_adapter.py`, `execution.py` | Finality spoofing, unverified receipt acceptance, failure-budget / compensating rollback bypass |
| **On-Chain Guardrail Contracts** | `contracts/` (`Sentinel`, `L3Relay`) | Unauthorized anomaly clearing, access control bypass, cross-chain message replay |

---

## 3. Severity & Bounty Tiers

| Severity | Impact Criteria | Bounty Range (USD / AETH) |
| :--- | :--- | :--- |
| **Critical** | Bypass of `BLOCK` invariants (`drain_ratio >= 0.9` or `signer_quorum_ratio < 0.5`), dual-signature forgery, or unauthorized unpause | $\$10,000 - \$25,000$ |
| **High** | Circuit breaker counter manipulation, compensating rollback failure leaving unverified controls active, or governance auto-rollback suppression | $\$3,000 - \$10,000$ |
| **Medium** | False-positive denial-of-service not mitigated by idempotency TTL, or telemetry/alarm suppression | $\$1,000 - \$3,000$ |
| **Low** | Minor threshold calibration drift inaccuracies or non-exploitable edge cases | $\$250 - \$1,000$ |
