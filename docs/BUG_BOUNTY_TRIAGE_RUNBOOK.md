# Private Bug Bounty Triage & Incident Response Runbook

**Owner:** Aetheron Security Operations & Sentinel L3 On-Call  
**Related Runbooks:** `docs/KILL_SWITCH_RUNBOOK.md`, `docs/PRIVATE_BUG_BOUNTY_SCOPE.md`, `docs/PRIVATE_BUG_BOUNTY_INVITATION_BRIEF.md`

---

## 1. Service Level Agreements (SLAs)

| Priority / Severity | Initial Acknowledgment | Kill-Switch Assessment | Reproduction & Triage | Patch & Verification |
| :--- | :--- | :--- | :--- | :--- |
| **P0 — Critical** | $\le 1\text{ hour}$ | $\le 5\text{ minutes}$ | $\le 4\text{ hours}$ | $\le 24\text{ hours}$ |
| **P1 — High** | $\le 4\text{ hours}$ | $\le 15\text{ minutes}$ | $\le 24\text{ hours}$ | $\le 72\text{ hours}$ |
| **P2 — Medium** | $\le 24\text{ hours}$ | N/A | $\le 3\text{ business days}$ | $\le 7\text{ days}$ |
| **P3 — Low** | $\le 48\text{ hours}$ | N/A | $\le 5\text{ business days}$ | Next scheduled release |

---

## 2. Step-by-Step Triage Workflow

### Step 1: Immediate Containment Check (`P0` / `P1`)
1. If a report credibly demonstrates a live bypass of `INV-1` (drain/quorum block), `INV-2` (post-quantum signature enforcement), or `INV-4` (compensating rollback) in an active environment:
   - Execute `docs/KILL_SWITCH_RUNBOOK.md` immediately (`SentinelInterceptor.engage_kill_switch("bounty_p0_containment")` or `POST /api/sentinel/kill-switch` with `{"active": true}`).
   - Verify fail-closed status via `GET /api/sentinel/health` (`killSwitchActive: true`, `systemHealthy: false`).

### Step 2: Deterministic Reproduction
1. Save the researcher's JSON payload to a scratch file (e.g., `poc_candidate.json`).
2. Execute the reproduction harness inside an isolated environment:
   ```bash
   PYTHONPATH=src python scripts/bug_bounty_repro_harness.py --poc poc_candidate.json
   ```
3. Inspect the harness output:
   - `"invariant_violated": true` confirms a reproducible invariant break under the canonical `conservative` profile.
   - If the finding involves multi-step state or concurrency, add a unit test in `tests/test_readiness.py` and run `bash scripts/ci_matrix.sh`.

### Step 3: Severity Scoring & Deduplication
- **Critical (`P0`)**:
  - Direct bypass of `BLOCK` decision when `drain_ratio > 0.90`, `anomaly_score > 0.95`, or `signer_quorum_ratio < 0.50`.
  - Forgery or downgrade bypass of `pq-ext` (`RealDilithiumBackend` / `Dilithium2`) signature verification when `CryptoAgilityRule(minimum_scheme="pq-ext", grace_days_remaining=0)` is active.
  - Kill-switch bypass when `kill_switch_active == True`.
- **High (`P1`)**:
  - Replay or race condition allowing duplicate `event_id` payloads to bypass `register_event` or corrupt circuit-breaker outflow counters.
  - Failure of `ActionExecutor(rollback_on_unverified=True)` to roll back prior controls or emit `ExecutionFailureAlarm` when an on-chain receipt fails verification.
  - Suppression of `GovernanceRegistry` critical drift auto-rollback (`policy_pack_auto_rollback`).
- **Medium (`P2`)**:
  - Asymmetric false-positive trigger allowing an unauthenticated actor to force `THROTTLE` / `BLOCK` across unrelated `bridge_id` or `actor_id` partitions below configured circuit-breaker thresholds.
- **Low (`P3`)**:
  - Minor telemetry, logging, or non-exploitable calibration edge cases.

### Step 4: Remediation & Regression Gate Closure
1. Implement the fix in `src/aetheron_sentinel_l3/` or `contracts/`.
2. Add the researcher's PoC as a permanent regression test in `tests/test_readiness.py`.
3. Run the complete release and staging verification suite:
   ```bash
   bash scripts/ci_matrix.sh
   npm run security:release-scope
   npm run test:release:policy
   ```
4. Record the commit SHA, two clean staging window reports (`staging-window-1` and `staging-window-2`), and issue the bounty award determination.
