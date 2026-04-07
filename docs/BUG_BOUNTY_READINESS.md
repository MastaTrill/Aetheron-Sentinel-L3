# Bug Bounty Readiness Checklist

## 1) Real chain integration checks
- Validate `JsonRpcOnChainAdapter` wiring against testnet endpoints.
- Verify transaction finality and compensating rollback flows.

## 2) PQ backend validation
- Integrate `PQBackend` provider implementation.
- Run dual-sign policy pack rollout in staging with automatic rollback drills.

## 3) Abuse and chaos testing
- Run idempotency flood tests and Redis retry/partition simulations.
- Track false-positive and false-negative KPIs via tournament scenarios.

## 4) Operational controls
- Define kill-switch runbook with on-call ownership.
- Add alert thresholds for governance critical drift and execution verification failures.

## 5) Launch sequencing
- Start with private bounty scope + capped blast radius.
- Expand public scope only after two clean staging windows.
