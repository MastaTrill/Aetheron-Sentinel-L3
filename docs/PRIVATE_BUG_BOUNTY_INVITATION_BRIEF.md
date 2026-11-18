# Aetheron Sentinel L3 (`v0.2.1`) — Private Bug Bounty Invitation Brief

**Program Status:** ACTIVE (Private Bug Bounty Cohort)  
**Target Release:** `v0.2.1` (Conservative Profile + Dual-Sign Post-Quantum Policy Pack)  
**Canonical Repository:** `MastaTrill/Aetheron-Sentinel-L3`

---

## 1. Welcome & Program Mission

You are invited to participate in the **Aetheron Sentinel L3 Private Bug Bounty**. Sentinel L3 is Aetheron's autonomous bridge liquidity-drain interceptor and on-chain guardrail suite (`SentinelInterceptor`, `CircuitBreaker`, `RateLimiter`) protecting cross-chain liquidity against high-velocity drain attacks, signer quorum degradation, and cryptographic downgrade attacks.

Following the completion of two clean staging validation windows (`staging-window-1` and `staging-window-2`), this private cohort focuses on breaking five core security invariants under the production `conservative` profile.

---

## 2. Core Security Invariants (Target Objectives)

A valid Critical or High submission must demonstrate a reproducible violation of at least one of the following invariants:

| ID | Invariant Name | Specification |
| :--- | :--- | :--- |
| **INV-1** | **Hard Drain & Quorum Block** | Any event with `amount / available_liquidity > 0.90`, `anomaly_score > 0.95`, or `PolicyEngine` critical rule match (`drain_ratio >= 0.85` or `signer_quorum_ratio < 0.50`) **must** return `action == "BLOCK"`. |
| **INV-2** | **Post-Quantum Dual-Sign Enforcement** | When `CryptoAgilityRule(minimum_scheme="pq-ext", grace_days_remaining=0)` is registered, any policy pack lacking a valid `pq-ext` (`Dilithium2`) primary or secondary signature **must** trigger `crypto_agility_noncompliant` and force `action == "BLOCK"`. |
| **INV-3** | **Idempotency Replay Isolation** | Any duplicate `event_id` submitted within `idempotency_ttl_seconds` (`3600s`) **must** be rejected immediately with `action == "BLOCK"`, `reasons == ("duplicate_event",)`, and `controls == ("drop_replay",)` without incrementing hourly outflow counters. |
| **INV-4** | **Compensating Rollback on Unverified Execution** | When `ActionExecutor(rollback_on_unverified=True)` submits multi-control actions via `JsonRpcOnChainAdapter` and any control fails finality verification (`status == 0x0` or insufficient confirmations), all previously applied controls in that batch **must** be rolled back and `ExecutionFailureAlarm` emitted. |
| **INV-5** | **Kill-Switch Fail-Closed Override** | When `engage_kill_switch()` is active, every evaluation **must** immediately return `action == "BLOCK"` with `kill_switch_engaged` regardless of input parameters or active policy pack overrides. |

---

## 3. In-Scope Assets

### A. Python Autonomous Interceptor & PQ Stack (`src/aetheron_sentinel_l3/`)
- `src/aetheron_sentinel_l3/interceptor.py` — `SentinelInterceptor`, circuit breakers, risk scoring, kill-switch
- `src/aetheron_sentinel_l3/policy.py` & `policy_pack.py` — `PolicyEngine`, dual-signed `PolicyPackManager`, canary & stage rollouts
- `src/aetheron_sentinel_l3/pq_backend.py` — `RealDilithiumBackend` (`dilithium_py` `Dilithium2`)
- `src/aetheron_sentinel_l3/governance.py` — `GovernanceRegistry`, `CryptoAgilityRule`, `DriftAlarm`, `ExecutionFailureAlarm`
- `src/aetheron_sentinel_l3/rpc_adapter.py` & `execution.py` — `JsonRpcOnChainAdapter`, finality polling, compensating rollback
- `src/aetheron_sentinel_l3/state.py` — `InMemoryStateBackend`, `RedisStateBackend`

### B. Solidity Guardrail Release Core (`contracts/`)
- `contracts/SentinelInterceptor.sol`
- `contracts/CircuitBreaker.sol`
- `contracts/RateLimiter.sol`

---

## 4. Out-of-Scope & Rules of Engagement

- **No Mainnet Disruption:** Do **not** submit transactions against live Base Mainnet pools or legacy non-canonical contracts (`0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`). All PoCs must run locally against the deterministic reproduction harness (`scripts/bug_bounty_repro_harness.py`), `LocalTestnetRpcServer`, or local Foundry/Hardhat forks.
- **No Third-Party Infrastructure Attacks:** Do not flood public RPC endpoints (`mainnet.base.org`, `sepolia.base.org`) or third-party APIs.
- **Retired Code Trees:** Anything under retired `v1.0` archive folders or `research/` is archived/non-canonical and out of scope.

---

## 5. Researcher Quickstart & Reproduction Harness

1. **Install the package with Post-Quantum extras:**
   ```bash
   python -m pip install --upgrade pip
   python -m pip install ".[pq]"
   ```
2. **Run the baseline invariant harness:**
   ```bash
   PYTHONPATH=src python scripts/bug_bounty_repro_harness.py
   ```
3. **Test a custom PoC payload JSON against the conservative production profile:**
   ```bash
   PYTHONPATH=src python scripts/bug_bounty_repro_harness.py --poc my_poc.json
   ```
   Example `my_poc.json`:
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
       "event_id": "poc-test-1"
     }
   }
   ```

---

## 6. Submission & Reward Schedule

Submit findings using `.github/ISSUE_TEMPLATE/private_bug_bounty_report.md` (via private security advisory or designated encrypted channel).

| Severity | Reward Tier (USD / AETH Equivalent) | SLA First Response |
| :--- | :--- | :--- |
| **Critical (`P0`)** | $\$10,000 - \$25,000$ | $\le 1\text{ hour}$ |
| **High (`P1`)** | $\$3,000 - \$10,000$ | $\le 4\text{ hours}$ |
| **Medium (`P2`)** | $\$1,000 - \$3,000$ | $\le 24\text{ hours}$ |
| **Low (`P3`)** | $\$250 - \$1,000$ | $\le 48\text{ hours}$ |
