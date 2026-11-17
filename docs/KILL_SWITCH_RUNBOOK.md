# Aetheron Sentinel L3 — Kill-Switch & Incident Response Runbook

## 1. On-Call Ownership & Escalation Matrix

| Role | Responsibility | SLA | Escalation Channel |
| :--- | :--- | :--- | :--- |
| **Primary Sentinel On-Call (SecOps)** | Real-time triage of `DriftAlarm(severity="critical")`, `ExecutionFailureAlarm`, and circuit breaker trips | $\le 5$ min | PagerDuty `#sentinel-l3-secops` |
| **Secondary Bridge Guardian (Core Eng)** | On-chain `Sentinel.pause()` / `L3Relay.pause()` execution and compensating rollback verification | $\le 10$ min | Guardian Multisig / Hardware Signer |
| **Governance & Cryptography Lead** | Policy pack rollback validation, post-quantum key rotation (`RealDilithiumBackend`), and post-mortem sign-off | $\le 30$ min | `#sentinel-governance-warroom` |

---

## 2. Alert Thresholds & Automated Actions

| Signal | Warning Threshold | Critical Threshold | Automated System Action | Operator Action |
| :--- | :--- | :--- | :--- | :--- |
| **Governance Calibration Drift** (`observed_drift = \|risk_score - 0.5\|`) | $\ge 0.20$ | $\ge 0.30$ | Emits `DriftAlarm(severity="critical")`, appends `governance_critical_drift`, triggers `PolicyPackManager.rollback()` (`policy_pack_auto_rollback`), and recommends `freeze_policy_changes` | Verify active policy pack reverted to baseline; inspect upstream oracle/velocity inputs |
| **Execution Verification Failure** (`ExecutionResult.verified == False`) | $\ge 1$ failure | $\ge 1$ failure | Appends `execution_verification_failed`, triggers `ActionExecutor` compensating `aetheron_rollbackControl`, emits `ExecutionFailureAlarm(severity="critical")` | Check RPC endpoint health (`probe_endpoint()`) and inspect unfinalized/reverted transaction hashes |
| **Crypto-Agility Non-Compliance** | Grace $\le 7$ days | Grace $= 0$ days without `pq-ext` / `pq-sim-dilithium` | Forces `BLOCK` with `crypto_agility_noncompliant` and control `rotate_signature_scheme` | Re-sign and roll out dual-signed policy pack (`hmac-sha256` + `pq-ext` via `RealDilithiumBackend`) |
| **Idempotency Replay Flood** | $> 50$ dup/min | $> 200$ dup/min | Immediately returns `BLOCK` (`duplicate_event` / `drop_replay`) without incrementing outflow counters | Block offending upstream IP/relayer at API gateway |

---

## 3. Kill-Switch Activation Procedure

### 3.1 Software Interceptor Kill-Switch (Immediate Zero-Trust Gate)
Engage the interceptor kill-switch to immediately block all bridge withdrawals and dispatch `activate_network_guard` and `pause_bridge` controls:

```python
interceptor.engage_kill_switch(reason="sev1_bridge_anomaly_detected")
```

### 3.2 On-Chain Smart Contract Pause (`Sentinel.sol` & `L3Relay.sol`)
1. Guardian or Owner invokes `Sentinel.pause()` and `L3Relay.pause()`.
2. Verify `Sentinel.systemHealthy() == false` and `L3Relay.paused() == true`.

---

## 4. Recovery & Kill-Switch Release Procedure

1. Confirm root cause resolved and Redis/RPC backends pass health checks (`adapter.probe_endpoint().healthy == True`).
2. Validate policy pack dual signatures (`hmac-sha256` + `pq-ext` `RealDilithiumBackend`).
3. Run `python scripts/run_staging_windows.py` and verify `all_windows_clean: true`.
4. Call `interceptor.release_kill_switch()`.
