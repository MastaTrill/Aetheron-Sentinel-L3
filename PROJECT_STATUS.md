# Aetheron Sentinel L3 — Canonical Project Status

**Status:** Active security flagship (`v0.2.1` guardrails & Python interceptor verified; Base Mainnet replacement in controlled-redeployment preparation)  
**Last updated:** 2026-11-18  
**Canonical role:** Security guardrails for Aetheron contracts and connected systems.

## Deployment truth

### Ethereum Sepolia — historical live deployment

- Network: Ethereum Sepolia
- Chain ID: `11155111`
- Deployment date recorded: April 23, 2026
- Human-readable registry: `docs/DEPLOYMENT_ADDRESSES.md`
- The registry records 27 historical/testnet contracts, including token, core, bridge, interceptor, circuit breaker, and rate limiter.

### Base Mainnet — deployed assets

Two different token deployments must not be conflated:

- **Aetheron (AETH)** — canonical Aetheron Platform token: `0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e`.
- **SENTINEL legacy deployment** — real deployed Base Mainnet token: `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`.
  - On-chain name/symbol: `SENTINEL` / `SENTINEL`
  - Decimals: `18`
  - Recorded total supply: `100000000000000000000000000000` (100 billion tokens)
  - Recorded owner/controller: `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12`
  - Creation transaction: `0x0733e1e5700ed354298511dd09d3966c8c02093700074cf97d6d231b4544a776`
  - Recorded Uniswap V4 pool ID: `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`
  - Current release classification: **legacy/non-canonical** under `release-evidence/sentinel-mainnet/redeployment-closure.json`.

The machine-readable Base inventory is `deployments/base-mainnet.json`. It records the legacy SENTINEL deployment explicitly so deployment existence is not confused with current release selection.

### SENTINEL controlled replacement — prepared, not deployed

- Active release model: `controlled-redeployment`.
- Exact deployment manifest and protected Base Sepolia rehearsal are recorded complete in the redeployment evidence package.
- The Base Mainnet deployment receipt is currently `status: "prepared"`; no replacement deployment transaction hash is recorded.
- Prepared/predicted replacement token address: `0x7C7528F49BdB879e5E10C93503E6590665c13FC8`.
- The legacy `0x8c1e…0ba3` token therefore remains an existing on-chain deployment, but it is not promoted back to canonical status.

### Base Sepolia — release evidence & Sentinel L3 v0.2.1 staging readiness

- The controlled SENTINEL replacement path has preserved Base Sepolia rehearsal evidence (`release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal.json`).
- The Python autonomous interceptor & post-quantum guardrail stack (`src/aetheron_sentinel_l3/`, `v0.2.1`) has completed two clean staging validation windows (`scripts/run_staging_windows.py`) with `RealDilithiumBackend` (`dilithium_py` `Dilithium2`), HTTP JSON-RPC finality & compensating rollback, Redis partition resilience, and kill-switch runbooks (`docs/KILL_SWITCH_RUNBOOK.md`, `docs/BUG_BOUNTY_READINESS.md`).
- Base Sepolia receipts and staging windows prove rehearsal and staging readiness only; they do not establish a Base Mainnet replacement broadcast until all 8 gates in `release-evidence/sentinel-mainnet/redeployment-closure.json` are completed via the protected Base Mainnet workflow.

## Production release scope

Only the following contracts are in the initial Sentinel guardrails Base release core (`config/release-core.json`):

1. `SentinelInterceptor`
2. `CircuitBreaker`
3. `RateLimiter`
4. Minimal ownership, monitoring, and configuration support required by those contracts

## Immediate cleanup queue

- [x] Locate the existing Base Mainnet SENTINEL deployment.
- [x] Record the legacy SENTINEL deployment in the Base Mainnet machine-readable inventory.
- [x] Keep the controlled-redeployment classification explicit instead of calling the legacy token canonical.
- [x] Reconcile remaining current-facing documents/scripts (`docs/SENTINEL_ARCHITECTURE_DECISION.md`, `docs/SENTINEL_EXTERNAL_GATE_RUNBOOK.md`, `scripts/deploy-vault.js`) that still used “canonical” for the legacy token while preserving immutable historical evidence unchanged.
- [x] Complete the separately gated guardrails staging readiness work (`v0.2.1` + release-scope and policy regression gates) while keeping Base Mainnet token replacement fail-closed (`status: "preparation-only"`) until protected mainnet broadcast gates complete.
