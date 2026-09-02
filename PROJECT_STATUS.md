# Aetheron Sentinel L3 — Canonical Project Status

**Status:** Active security flagship  
**Last updated:** 2026-09-02  
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
- A live Base Mainnet read on 2026-09-02 returned no runtime bytecode at that prepared address, consistent with the repository's `prepared` rather than `deployed` status.
- The legacy `0x8c1e…0ba3` token therefore remains an existing on-chain deployment, but it is not automatically promoted back to canonical status.

### Base Sepolia — release evidence, not Base production

The controlled SENTINEL replacement path has preserved Base Sepolia rehearsal evidence. Base Sepolia receipts prove rehearsal execution only; they do not establish a Base Mainnet replacement deployment.

The Sentinel guardrails release core (`SentinelInterceptor`, `CircuitBreaker`, `RateLimiter`) has its own deployment/review gates and must be tracked separately from token redeployment.

## Production release scope

Only the following contracts are in the initial Sentinel guardrails Base release core:

1. `SentinelInterceptor`
2. `CircuitBreaker`
3. `RateLimiter`
4. Minimal ownership, monitoring, and configuration support required by those contracts

## Experimental or separately gated scope

The following areas are research, token-specific, or later-phase work unless promoted through a separately reviewed release:

- SENTINEL token economics and controlled replacement
- Bridge and LayerZero integrations
- Governance and staking
- Yield optimization
- Insurance
- AMM and liquidity systems
- ZK identity and ZK oracle components
- Quantum-named components
- Homomorphic-encryption components
- Predictive threat models
- Mobile PWA and marketing/presale UI

## Repository rules

1. `deployments/base-mainnet.json` is the machine-readable inventory for Base Mainnet token deployments and must label each entry's canonical/legacy state explicitly.
2. `docs/DEPLOYMENT_ADDRESSES.md` remains the human-readable historical chain registry.
3. New deployments must produce a machine-readable manifest and transaction receipt.
4. A live on-chain contract may still be `legacy-non-canonical`; deployment existence and release approval are separate facts.
5. Filenames containing `MAINNET`, `COMPLETE`, `CANONICAL`, or `VERIFIED` must match the current release decision or carry an explicit historical/superseded banner.
6. Simulations must be labeled `simulation`; readiness runs must be labeled `non-broadcast` or `prepared` until a receipt proves broadcast.
7. Generated artifacts and deprecated duplicate trees must not be treated as separate canonical sources.
8. Production scope changes require tests, threat-model updates, and release-gate review.

## Immediate cleanup queue

- [x] Locate the existing Base Mainnet SENTINEL deployment.
- [x] Record the legacy SENTINEL deployment in the Base Mainnet machine-readable inventory.
- [x] Keep the controlled-redeployment classification explicit instead of calling the legacy token canonical.
- [ ] Reconcile remaining current-facing documents/scripts that still use “canonical” for the legacy token while preserving immutable historical evidence unchanged.
- [ ] Complete the separately gated replacement/guardrails release work before representing any new SENTINEL or guardrail deployment as Base Mainnet production.
