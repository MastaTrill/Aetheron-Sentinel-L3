# Aetheron Sentinel L3 — Mainnet Readiness Audit (2026-09-25)

Candidate base SHA: `78a06bc3510871c944da4059df8bf322e426541d`

## Purpose

This branch exists to produce fresh CI evidence against the exact current main candidate without changing production or deploying contracts.

## Current verified observations

- The latest combined commit status on the base SHA is red only because Vercel reports: `Account is blocked.`
- No GitHub Actions workflow run is associated with the exact base SHA through the commit-run lookup.
- The canonical CI workflow is configured to run on pull requests to `main`.
- The CI contract lane includes:
  - release-scope validation
  - deterministic deployment-artifact compilation
  - release regression tests
  - source-verification policy tests
  - Foundry build
  - Foundry tests
  - gas snapshot enforcement
  - lint
  - web build
- Direct mainnet deployment remains disabled by package policy; the protected Base mainnet workflow is required.
- The public AETH presale UI is closed and must not be treated as an active sale.

## Release decision

Do **not** deploy to Base mainnet from this audit branch.

Required before mainnet:
1. Fresh green CI on this exact candidate lineage.
2. Review any genuine Solidity, release-policy, or security failures from CI.
3. Review dependency PRs individually, especially OpenZeppelin changes.
4. Revalidate Base Sepolia rehearsal and verification evidence.
5. Lock the final release SHA and use the protected Base mainnet deployment path.

## Infrastructure note

A Vercel account block is a hosting/account condition and must not be conflated with Solidity correctness. It remains an operational blocker for that deployment target, but contract release readiness must be determined from contract/security CI and test evidence.
