# Aetheron Sentinel L3 — Concord Enterprise CI/CD

This repository uses the repository root as the canonical project directory. The enterprise workflows therefore do **not** set a nested `working-directory`.

## Workflow suite

- `enterprise-ci-matrix.yml` — Node 20/24 × Foundry v1.7.1/nightly matrix, release policy gates, contract compile/build/test, gas snapshot enforcement, lint, and web build.
- `enterprise-security-slither.yml` — weekly/push/PR Slither analysis with SARIF upload to GitHub Code Scanning and a high-severity failure gate.
- `enterprise-release.yml` — semantic-version tag validation, release governance tests, deterministic contract artifact packaging, SHA-256 checksum generation, Actions artifact retention, and GitHub Release publication.
- `enterprise-governance.yml` — `[L3]` PR title policy, existing `security` + `github_actions` governance labels, ready-for-review requirement, and two distinct non-author approvals.

## Compatibility choices

The legacy Concord draft used Node 18/20 and a nested `Aetheron-Sentinel-L3` working directory. The current repository already uses Node 24 in CI, Hardhat 3.x, Next.js 16.x, and Foundry v1.7.1. This suite uses Node 20/24 for compatibility coverage while keeping Node 24 + Foundry v1.7.1 as the canonical enforcement lane.

## Required repository settings

After this PR is validated, configure the `main` branch/ruleset to require the canonical enforcement checks produced by:

1. `Concord Enterprise CI Matrix` — Node 24 / Foundry v1.7.1 lane.
2. `Concord Enterprise Security - Slither`.
3. `Concord Enterprise Governance`.
4. Existing release-safety checks that remain part of the protected mainnet deployment path.

Also keep direct mainnet deployment restricted to the protected deployment workflow and preserve the existing immutable-release/release-scope policy scripts.

## Required PR metadata

Before merge, a PR must:

- include `[L3]` in the title;
- have the existing `security` and `github_actions` labels;
- be ready for review;
- have at least two distinct approvals from reviewers other than the PR author.

## Release flow

Create and push a semantic version tag such as `v1.2.3`. The release workflow verifies the tag, runs release governance gates and contract tests, rebuilds artifacts, packages the release payload, writes a SHA-256 checksum, uploads the immutable Actions artifact, and publishes/updates the GitHub Release.
