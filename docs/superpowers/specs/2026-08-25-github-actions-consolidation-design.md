# GitHub Actions Consolidation Design

## Problem

Aetheron Sentinel L3 currently has 40 workflow files and 19,393 historical GitHub Actions runs. Multiple workflows react to the same push or pull request, several repeat the same Foundry/npm/security work, and `Sentinel Readiness Command` chains from `PR Validation` through `workflow_run`. This causes one code change to fan out into many independent workflow runs.

## Goals

- Reduce the active workflow set from 40 files to 8 canonical workflows.
- Preserve the release-safety, Base Sepolia, Base mainnet, CodeQL, deployment-environment, and post-deployment verification controls.
- Eliminate duplicate push/pull-request pipelines and workflow-to-workflow fan-out.
- Add path filters and concurrency cancellation where cancellation is safe.
- Keep production deployment manual, explicit, protected, and non-cancellable.
- Move expensive fuzzing and broad security scans away from routine documentation/site-only changes.

## Non-goals

- No Solidity contract changes.
- No deployment-script changes.
- No secret, environment, ruleset, or branch-protection changes.
- No automatic mainnet deployment.
- No weakening of the existing immutable-release or Base Sepolia rehearsal requirements.

## Canonical workflow set

1. `.github/workflows/ci.yml` — the single PR/main build-and-test workflow.
2. `.github/workflows/security.yml` — dependency review/audit, Slither, Semgrep, and scheduled Echidna.
3. `.github/workflows/deploy-dashboard-vercel.yml` — dashboard-only production deployment.
4. `.github/workflows/deploy-site.yml` — static GitHub Pages deployment only when `site/**` changes.
5. `.github/workflows/base-sepolia-pipeline.yml` — manual Base Sepolia rehearsal/deployment gate.
6. `.github/workflows/mainnet-pipeline.yml` — protected manual Base mainnet deployment gate.
7. `.github/workflows/dependabot-auto-merge.yml` — lightweight Dependabot merge policy.
8. `.github/workflows/post-deploy-nightly-verification.yml` — nightly/post-deploy control verification without duplicate npm auditing.

## CI trigger strategy

`ci.yml` is the only general code-validation workflow. It runs for pull requests to `main`, pushes to `main`, and explicit manual dispatches. Documentation and static-site-only changes are ignored. Concurrency is keyed to the PR or branch and cancels superseded CI runs.

The CI job performs one checkout/setup cycle, release-scope validation, exact compilation, release regression tests, Foundry build/tests, and linting. It intentionally avoids running the same audit/scanner jobs that are owned by `security.yml`.

## Security trigger strategy

`security.yml` owns all expensive security work. Pull requests and pushes only trigger it when contracts, tests, scripts, dependency manifests, Foundry/Hardhat configuration, Slither/Semgrep configuration, or the workflow itself changes. A weekly Monday run performs dependency auditing and static analysis. A weekly Wednesday run performs Echidna property fuzzing. Manual dispatch runs all security jobs.

Dependency review remains a PR gate for dependency-bearing changes. Slither scans the three release-critical guardrail contracts. Semgrep retains SARIF upload. Echidna remains fail-open only when no property contract exists, matching current behavior.

## Deployment strategy

Base Sepolia and Base mainnet pipelines remain manual-only and retain non-cancellable concurrency groups. The old alternative mainnet/redeployment/release workflows are removed so there is one canonical testnet path and one canonical mainnet path.

Dashboard deployment keeps path filtering and gains cancellation of superseded production builds. GitHub Pages deployment is changed to run only for static-site changes and no longer installs Node/npm because it only copies static files.

## Verification strategy

`post-deploy-nightly-verification.yml` keeps the nightly Sepolia/mainnet ownership, allowlist, and relayer checks. The duplicate dependency-audit job is removed because dependency auditing is centralized in `security.yml`.

## Branch protection and required checks

The repository's visible branch metadata reports no required status-check contexts on `main`. The visible active rulesets focus on signed/linear updates, pull requests, Copilot review, and CodeQL rather than named legacy workflow checks. Therefore removing legacy workflow names should not strand pull requests waiting for obsolete check contexts.

## Rollback

All changes are made on `chore/actions-consolidation-20260825` and proposed through a pull request. The current `main` workflow set remains unchanged until merge. If validation exposes a missing gate, the PR can be amended or closed without affecting production.
