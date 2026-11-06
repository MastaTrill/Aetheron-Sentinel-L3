# Sentinel L3 release audit — 2026-10-14

This file documents release gates only; it does not authorize mainnet writes.

## Canonical ownership
Sentinel security contracts and release evidence live here. AETH token, presale, staking and frontend authority remain in `MastaTrill/Aetheron_platform`. `MastaTrill/Aetheron` is legacy.

## Release classification
- Legacy Base SENTINEL token: `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`, **legacy/non-canonical**.
- Prepared replacement address: `0x7C7528F49BdB879e5E10C93503E6590665c13FC8`, **not confirmed deployed**.
- Mainnet replacement deployment receipt, post-deployment authority/RPC checks, buy/sell smoke and immutable evidence: **pending** per `docs/SENTINEL_TOKEN_MAINNET.md`.

## Release gates
- [ ] Verify current main HEAD, contract compilation, unit/fuzz/invariant tests and security checks.
- [ ] Check role ownership, privileged entry points, bridge protection, deployment manifest and authorization against exact commit.
- [ ] Verify Base Sepolia rehearsal and current Base Mainnet RPC independently.
- [ ] Resolve pending major-version dependency PRs (including Express 5) only after compatibility tests.
- [ ] Diagnose Vercel deployment-blocked status separately from application test failures.
- [ ] Reconcile release evidence and runtime bytecode before changing production integrations.
- [ ] Preserve all historical addresses and evidence; no signing, migration, pool, mint, liquidity or mainnet transaction without explicit independent authorization.

## Current CI finding
The inspected HEAD reports a failing Vercel status linking to `https://vercel.com/knowledge/why-is-my-account-deployment-blocked`. This alone does not identify an application defect.
