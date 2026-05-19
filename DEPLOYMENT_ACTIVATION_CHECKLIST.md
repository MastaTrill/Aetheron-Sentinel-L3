# Sentinel L3 Mainnet Activation Checklist

## Pre-activation

- [ ] OWNER_PRIVATE_KEY matches Keeper’s Lantern wallet
- [ ] BASE_MAINNET_RPC_URL is production-grade
- [ ] BASESCAN_API_KEY is valid
- [ ] Solc version is 0.8.24 everywhere
- [ ] Optimizer settings match in Foundry and Hardhat
- [ ] Git state is clean; tag the commit (e.g. sentinel-l3-v1)
- [ ] Owner & guardian roles clearly defined
- [ ] Pause/emergency controls tested on fork
- [ ] Upgrade paths disabled or tightly controlled

## Pipeline execution

- [ ] `npm run mainnet:preflight`
- [ ] `npm run mainnet:build`
- [ ] `npm run mainnet:test`
- [ ] `npm run mainnet:simulate`
- [ ] `DEPLOY_TAG=sentinel-l3-v1 npm run deploy:base`
- [ ] `DEPLOY_TAG=sentinel-l3-v1 npm run verify:base`
- [ ] `DEPLOY_TAG=sentinel-l3-v1 npm run patch:base`

## Post-activation validation

- [ ] Addresses match deployments/base-mainnet.json
- [ ] Roles (owner, guardian, operator) set as intended
- [ ] Critical params (thresholds, fees, limits) match spec
- [ ] All contracts verified on Basescan
- [ ] Constructor args visible and correct
- [ ] Run read-only health script against mainnet to confirm invariants
- [ ] Confirm pause/unpause and key flows behave as expected on fork

---

**This checklist ensures a deterministic, mainnet-safe, and auditable launch for Aetheron Sentinel L3.**
