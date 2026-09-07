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

The protected Base Sepolia pipeline is pinned to commit:

`f165e345f6909ffb8c3d9eab1f152aa5bd23e97b`

and both its readiness and deployment jobs check out that exact commit before validation, tests, Foundry execution, simulation, or any permitted testnet broadcast.

## 2. Version-consistency statement

The audit target remains `f165e345f6909ffb8c3d9eab1f152aa5bd23e97b`. Current `main` has advanced materially since the original 2026-08-19 comparison, including workflow consolidation and unrelated application/repository changes. Those later commits are **not** implicitly promoted into the audited Guardrails release.

For this release, deployment-bearing workspace code must be checked out from the exact audit target. If any Solidity source, deployment script, constructor input, linked library, compiler configuration, dependency pin affecting produced bytecode, or release-scope file is intentionally changed for a new Guardrails release, a new release candidate must be reviewed and this handoff must be updated before deployment evidence is treated as authoritative.

## 3. Required authoritative readiness gates

The current protected release control is `.github/workflows/base-sepolia-pipeline.yml`. Its readiness phase is run with `broadcast: false`, is transaction-free, and requires the protected `base-sepolia` environment. Its authoritative gates include:

1. exact checkout of the pinned release commit with recursive submodules;
2. protected deployment-environment validation;
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

A Base Sepolia broadcast is a separate phase and is eligible only when `broadcast: true`, the confirmation is exactly `DEPLOY_BASE_SEPOLIA`, readiness succeeds, and the protected environment approval is satisfied. This handoff itself does not authorize that broadcast.

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

The designated deployer was also observed with `0.160079563425138642 ETH` on Base Sepolia, above the audited release default threshold of `0.05 ETH`.

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
- Protected Base Sepolia pipeline: `.github/workflows/base-sepolia-pipeline.yml`
- Deployment manifest path: `deployments/baseSepolia-sentinel-guardrails-v1.json`

If the release target changes, update this handoff before requesting or relying on an independent audit.
