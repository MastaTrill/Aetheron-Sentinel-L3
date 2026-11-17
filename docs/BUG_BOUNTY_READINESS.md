# Bug Bounty Readiness Checklist

**Status:** READY FOR PRIVATE BUG BOUNTY LAUNCH (2/2 Clean Staging Windows Completed)

## 1) Real chain integration checks — COMPLETED
- [x] Validate `JsonRpcOnChainAdapter` wiring against HTTP JSON-RPC testnet endpoints (`LocalTestnetRpcServer` emulating Base Sepolia `chainId=84532` + live `probe_endpoint()` via `eth_chainId` and `eth_blockNumber`).
- [x] Verify transaction finality (`blockNumber` confirmation calculation & `confirmations` polling) and automatic compensating rollback flows (`rollback_on_unverified=True` and `apply_with_rollback_guard`).

## 2) PQ backend validation — COMPLETED
- [x] Integrate `RealDilithiumBackend` provider implementation using `dilithium_py` (`Dilithium2` packed keygen, signing, and verification with optional deterministic DRBG seeding).
- [x] Run dual-sign (`hmac-sha256` + `pq-ext`) policy pack rollout in staging with automatic rollback drills upon critical governance drift.

## 3) Abuse and chaos testing — COMPLETED
- [x] Run concurrent idempotency flood tests (200+ concurrent replay flood events blocked with `duplicate_event` / `drop_replay`) and Redis retry/partition simulations (`test_redis_partition_simulation_and_recovery`).
- [x] Track false-positive and false-negative KPIs via single-pass tournament scenarios (`TPR = 1.0`, `FPR = 0.0`, `MTTR = 3.0 min`).

## 4) Operational controls — COMPLETED
- [x] Define kill-switch runbook with on-call ownership (`docs/KILL_SWITCH_RUNBOOK.md`) and runtime `engage_kill_switch()` / `release_kill_switch()` controls on `SentinelInterceptor`.
- [x] Configure alert thresholds for governance warning drift (`0.20`), critical drift (`0.30`), and execution verification failures (`execution_failure_threshold = 1` emitting `ExecutionFailureAlarm`).

## 5) Launch sequencing — COMPLETED
- [x] Complete two clean staging windows (`scripts/run_staging_windows.py` -> `staging-window-1` and `staging-window-2` passed all gates).
- [x] Ready to start private bounty scope with capped blast radius (`max_hourly_drain_ratio = 0.25`, conservative profile / dual-signed policy pack).
