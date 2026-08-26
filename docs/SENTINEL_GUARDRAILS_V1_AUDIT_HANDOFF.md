# Sentinel Guardrails v1 — Canonical Audit Handoff

**Prepared:** 2026-08-19  
**Release profile:** `sentinel-guardrails-v1`  
**Audit target commit:** `f165e345f6909ffb8c3d9eab1f152aa5bd23e97b`  
**Test network:** Base Sepolia (`84532`)  
**Production network:** Base Mainnet (`8453`) — not authorized by this document

## 1. Exact release boundary

The security/release review target is the three-contract Guardrails core only:

- `SentinelInterceptor`
- `CircuitBreaker`
- `RateLimiter`

The prior public 27-contract deployment path is retired and is not part of this release boundary.

The protected current-release readiness workflow is pinned to commit:

`f165e345f6909ffb8c3d9eab1f152aa5bd23e97b`

and checks out that exact commit before validation, tests, Foundry execution, and deployment simulation.

## 2. Version-consistency statement

As of 2026-08-19, `main` is eight commits ahead of the audit target. Comparing the audit target with current `main` shows changes only in:

- `.github/workflows/sentinel-environment-diagnostics.yml`
- `.github/workflows/sentinel-readiness-current-release.yml`

No Solidity contract source file is changed in that comparison. The post-target changes are release/readiness diagnostics and protected-environment workflow hardening; they do not move the three-contract audit target.

If any Solidity, deployment script, constructor input, linked library, compiler configuration, dependency pin affecting produced bytecode, or release-scope file changes after this handoff, the audit target must be reconsidered and this document updated.

## 3. Required authoritative readiness gates

The protected `Sentinel Current Release Readiness` workflow is broadcast-disabled and requires the protected `base-sepolia` environment. Its authoritative gates include:

1. exact checkout of the pinned release commit with recursive submodules;
2. protected deployment-environment validation, including required reviewers;
3. governance-owner validation on Base Sepolia;
4. frozen three-contract release-scope validation;
5. Base Sepolia RPC, signer, balance, owner, and monitor preflight;
6. release dependency and toolchain audits;
7. Solidity compilation;
8. release regression tests;
9. Foundry build and tests;
10. exact deployment simulation without broadcast;
11. readiness evidence artifact preservation.

Representative commands used by the protected workflow:

```text
npm ci --legacy-peer-deps
npm run security:deployment-environment
npm run security:release-scope
npm run preflight:base-sepolia
npm run security:audit
npm run security:audit:toolchain
npm run compile
npm run test:release
forge build --sizes
forge test -vvv
npm run mainnet:simulate
```

## 4. Governance policy

The protected readiness workflow fails closed unless `OWNER_ADDRESS` is a deployed governance contract on Base Sepolia that satisfies one of:

- Safe with at least 3 owners and threshold at least 2; or
- compatible OpenZeppelin timelock with `getMinDelay() >= 172800` seconds (48 hours).

Owner, deployer, and monitor roles must remain separated.

## 5. Current read-only Base Sepolia observations

A 2026-08-19 independent read-only RPC verification recorded the existing three-contract Guardrails deployment as live and paused:

| Contract | Base Sepolia address | Observed state |
|---|---|---|
| `SentinelInterceptor` | `0x5459D1398B0d29a758432183B6Fb306B46aD64f3` | `paused() = true` |
| `CircuitBreaker` | `0x7233e0805d71EEd3632a9E7579C5Fdfd7Fd6b88B` | `paused() = true` |
| `RateLimiter` | `0xB84Cc1C36a8a037F56B85d4634fd293e89D59257` | `paused() = true` |

All three returned owner:

`0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`

The designated deployer was also observed with `0.160079563425138642 ETH` on Base Sepolia, above the workflow threshold of `0.05 ETH`.

These observations prove current on-chain state only. They do **not** substitute for the protected readiness workflow, immutable deployment manifest, source/bytecode verification, or proof that a deployment originated from the exact audit target commit.

## 6. Protected-environment status

Repository diagnostics reported:

- one required deployment reviewer;
- custom deployment-branch policies enabled;
- secret/variable metadata visibility as `unknown` when the workflow token could not read secret-name metadata.

`unknown` is not evidence that a secret is absent. The protected readiness job is authoritative because environment-scoped secrets are resolved only after the environment gate is satisfied.

## 7. Evidence that must be preserved before mainnet consideration

Before any Base Mainnet authorization, preserve an independently reproducible packet containing at minimum:

- exact release commit SHA;
- immutable release tag resolving to that SHA;
- successful protected Base Sepolia readiness workflow run ID;
- exact deployment manifest and SHA-256 digest;
- deployed contract addresses and transaction hashes;
- block numbers;
- runtime bytecode hashes;
- source-verification evidence;
- paused-state evidence;
- owner and monitor-role evidence;
- independent audit report covering this exact release target;
- audit report SHA-256 digest;
- separate Base Mainnet protected-environment approval;
- independent mainnet go/no-go review.

## 8. Explicit non-authorization

This document does not authorize:

- Base Mainnet deployment;
- unpausing;
- custody activation;
- asset movement;
- liquidity operations;
- token trading;
- replacement or bypass of protected-environment approval.

Its purpose is to bind the audit and release process to one explicit three-contract target and make later evidence reproducible.

## 9. Release-control references

- Launch gate: issue `#169`
- Protected readiness workflow: `.github/workflows/sentinel-readiness-current-release.yml`
- Deployment manifest path: `deployments/baseSepolia-sentinel-guardrails-v1.json`

If the release target changes, update this handoff before requesting or relying on an independent audit.
