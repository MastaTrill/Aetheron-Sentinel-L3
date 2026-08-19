# Aetheron Sentinel L3 — Canonical Project Status

**Status:** Active security flagship  
**Canonical role:** Security guardrails for Aetheron contracts and connected systems.

## Deployment truth

### Ethereum Sepolia — historical live deployment

- Network: Ethereum Sepolia
- Chain ID: `11155111`
- Deployment date recorded: April 23, 2026
- Canonical registry: `docs/DEPLOYMENT_ADDRESSES.md`
- The registry records 27 deployed contracts, including the token, core, bridge, interceptor, circuit breaker, and rate limiter.

### Base Sepolia — current release target (CANCELLED)

- The guarded Base Sepolia release has been skipped.
- We are proceeding directly to Mainnet integration due to existing deployed tokens.

### Base Mainnet — active

- Sentinel L3 tokens are ALREADY deployed to Base Mainnet:
  - **Aetheron (AETH)**: `0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e`
  - **SENTINEL Token**: `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`
- Do not reuse Ethereum Sepolia addresses in Base configuration.

## Production release scope

Only the following contracts are in the initial Base release core:

1. `SentinelInterceptor`
2. `CircuitBreaker`
3. `RateLimiter`
4. Minimal ownership, monitoring, and configuration support required by those contracts

## Experimental scope

The following areas are research or later-phase work unless promoted through a separately reviewed release:

- SentinelToken and token economics
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

1. `docs/DEPLOYMENT_ADDRESSES.md` is the human-readable chain registry.
2. New deployments must also produce a machine-readable manifest.
3. Filenames containing `MAINNET`, `COMPLETE`, or `VERIFIED` must match the actual chain and evidence state.
4. Simulations must be labeled `simulation`; readiness runs must be labeled `non-broadcast`.
5. Generated artifacts and the duplicate `sentinel-l3-v1.0/` tree must not be treated as separate canonical sources.
6. Production scope changes require tests, threat-model updates, and release-gate review.

## Immediate cleanup queue

- [x] Rename misleading mainnet-complete documents that contain Sepolia rehearsal evidence.
- [x] Select the root tree as canonical and deprecate duplicate nested release files.
- [x] Move experimental contracts and documents under a clearly labeled research area.
- [x] Remove generated artifacts from version control where reproducible.
- [x] Locate existing Base Mainnet token deployments.
- [ ] Next Steps: To be determined (e.g., verifying ownership of mainnet tokens, continuing Sentinel redeployment, etc.)
