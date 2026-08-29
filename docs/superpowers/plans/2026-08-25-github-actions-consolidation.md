# GitHub Actions Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Aetheron Sentinel L3 from 40 overlapping GitHub Actions workflows to 8 canonical workflows without weakening deployment or security gates.

**Architecture:** Centralize routine code validation in `ci.yml`, centralize expensive security tooling in `security.yml`, preserve the canonical Base Sepolia and Base mainnet manual pipelines, and keep only narrowly triggered UI/site/verification automation. Delete legacy wrapper workflows so one repository event cannot fan out through multiple duplicate pipelines or `workflow_run` chains.

**Tech Stack:** GitHub Actions YAML, Foundry v1.7.1, Node.js 24, Hardhat 3, Slither, Semgrep, Echidna, Vercel CLI, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-25-github-actions-consolidation-design.md`

## Global Constraints

- Keep production deployment manual and protected.
- Do not change Solidity contracts, deployment scripts, secrets, environments, rulesets, or branch protection.
- Preserve `security:release-scope`, release regression tests, Foundry build/tests, Slither, Semgrep SARIF, Echidna, Base Sepolia rehearsal, immutable release, and mainnet verification controls.
- Use concurrency cancellation only for supersedable CI/security/dashboard runs; never cancel deployment runs.
- End with exactly eight workflow YAML files.

---

### Task 1: Unify routine CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Delete later: `.github/workflows/test.yml`, `.github/workflows/pr-validation.yml`, `.github/workflows/hardhat-test.yml`, `.github/workflows/lint.yml`, `.github/workflows/gas-analysis.yml`, `.github/workflows/sentinel-ci-memory-optimized.yml`, `.github/workflows/enterprise-ci-matrix.yml`

**Interfaces:**
- Consumes: root `package.json`, `package-lock.json`, Foundry config, contract/test sources.
- Produces: one `CI / Build, test and release policy` check for PRs and `main` pushes.

- [ ] **Step 1: Replace duplicate triggers with one PR/main/manual trigger**

Use `pull_request` and `push` scoped to `main`, ignore Markdown/docs/static-site-only changes, add manual dispatch, and add PR/branch concurrency with `cancel-in-progress: true`.

- [ ] **Step 2: Run one canonical validation job**

The job must run, in order: checkout with submodules, Node 24, Foundry v1.7.1, `npm ci --legacy-peer-deps`, `npm run security:release-scope`, `npm run compile`, `npm run test:release`, `forge build --sizes`, `forge test -vvv`, and `npm run lint`.

- [ ] **Step 3: Validate YAML and verify old duplicate CI files are scheduled for deletion**

Expected result: routine code events produce one general CI workflow run instead of several overlapping build/test workflows.

### Task 2: Consolidate security scanning

**Files:**
- Modify: `.github/workflows/security.yml`
- Delete later: `.github/workflows/semgrep.yml`, `.github/workflows/echidna-fuzz.yml`, `.github/workflows/npm-audit.yml`, `.github/workflows/ai-security-test.yml`, `.github/workflows/enterprise-security-slither.yml`, `.github/workflows/sentinel-security-audit.yml`, `.github/workflows/security-supply-chain.yml`

**Interfaces:**
- Consumes: dependency manifests, contracts/tests/scripts, `slither.config.json`, `.semgrep/**`, Echidna configuration/property contract.
- Produces: PR dependency review, Slither/Semgrep static-analysis results, weekly dependency audit, weekly Echidna fuzz run.

- [ ] **Step 1: Narrow event paths and add concurrency**

Trigger on `main` PR/push only for security-relevant source/config/dependency paths, plus Monday and Wednesday schedules and manual dispatch. Cancel superseded security runs for the same ref.

- [ ] **Step 2: Keep dependency review on PRs and dependency audit on Monday/manual runs**

Use `actions/dependency-review-action@v5` with `fail-on-severity: high`. Run `npm run security:audit` and `npm run security:audit:toolchain` for scheduled/manual dependency auditing and upload the JSON report.

- [ ] **Step 3: Keep Slither and Semgrep static analysis**

Build once for Slither and scan `SentinelInterceptor.sol`, `CircuitBreaker.sol`, and `RateLimiter.sol` with `--fail-high`; upload SARIF. Run Semgrep with the current rules and upload SARIF/artifact.

- [ ] **Step 4: Run Echidna only on Wednesday/manual**

Install Echidna v2.2.6, build with Foundry, locate the existing property contract if present, and run it with the existing config/default behavior.

### Task 3: Narrow web deployment automation

**Files:**
- Modify: `.github/workflows/deploy-dashboard-vercel.yml`
- Modify: `.github/workflows/deploy-site.yml`

**Interfaces:**
- Dashboard consumes Vercel secrets and dashboard sources; produces a production Vercel deployment.
- Pages consumes `site/**`; produces the GitHub Pages artifact/deployment.

- [ ] **Step 1: Add dashboard concurrency**

Use a fixed production dashboard concurrency group and `cancel-in-progress: true` so a newer dashboard commit supersedes an older build.

- [ ] **Step 2: Make Pages path-specific and remove unnecessary npm setup**

Trigger Pages only for `site/**` or its workflow file. Build the Pages artifact by copying `site/*` without Node setup or `npm ci`.

### Task 4: Keep one canonical testnet and one canonical mainnet deployment path

**Files:**
- Keep unchanged: `.github/workflows/base-sepolia-pipeline.yml`
- Keep unchanged: `.github/workflows/mainnet-pipeline.yml`
- Delete later: `.github/workflows/deploy-base-mainnet.yml`, `.github/workflows/deploy.yml`, and legacy Sentinel release/redeployment/rehearsal workflows.

**Interfaces:**
- Base Sepolia produces the rehearsal/deployment artifact consumed by mainnet.
- Base mainnet requires reviewed commit/tag/rehearsal evidence and protected environment before broadcast.

- [ ] **Step 1: Verify both canonical pipelines are manual-only and non-cancellable**

Expected result: neither workflow has `push`, `pull_request`, `schedule`, or `workflow_run` triggers.

- [ ] **Step 2: Remove alternative deployment/release workflows**

Expected result: users cannot accidentally choose among multiple divergent mainnet pipelines.

### Task 5: Reduce verification and Dependabot noise

**Files:**
- Modify: `.github/workflows/post-deploy-nightly-verification.yml`
- Modify: `.github/workflows/dependabot-auto-merge.yml`

**Interfaces:**
- Verification consumes public/secret RPC values and existing audit scripts; produces nightly verification logs.
- Dependabot consumes PR metadata; enables squash auto-merge only for allowed updates.

- [ ] **Step 1: Remove duplicate npm auditing from nightly verification**

Keep Sepolia and mainnet ownership/allowlist/relayer verification jobs; dependency auditing belongs only to `security.yml`.

- [ ] **Step 2: Add Dependabot concurrency and remove the unused `labeled` trigger**

Keep `opened`, `reopened`, `synchronize`, and `ready_for_review`; group by PR number and cancel superseded metadata runs.

### Task 6: Delete obsolete workflows in one commit

**Files:**
- Delete every `.github/workflows/*.yml` file except the eight listed in the spec.

**Interfaces:**
- Consumes: the completed canonical workflow replacements.
- Produces: a workflow directory containing exactly eight YAML files.

- [ ] **Step 1: Delete the 32 obsolete workflow files**

The retained set must be exactly: `base-sepolia-pipeline.yml`, `ci.yml`, `dependabot-auto-merge.yml`, `deploy-dashboard-vercel.yml`, `deploy-site.yml`, `mainnet-pipeline.yml`, `post-deploy-nightly-verification.yml`, and `security.yml`.

- [ ] **Step 2: Verify no retained workflow contains `workflow_run`**

Expected result: repository workflow chaining is eliminated.

- [ ] **Step 3: Verify trigger counts**

Expected result: one general PR CI workflow, one path-limited security workflow, two narrow web deploy workflows, two manual blockchain deployment workflows, one Dependabot workflow, and one nightly verification workflow.

### Task 7: Validate and open the pull request

**Files:**
- Review all modified/deleted workflow files and the two Superpowers documents.

**Interfaces:**
- Produces: a reviewable PR against `main` with GitHub Actions validation evidence.

- [ ] **Step 1: Parse all eight YAML files**

Expected result: all workflow documents are syntactically valid YAML.

- [ ] **Step 2: Compare branch to `main`**

Expected result: only workflow consolidation plus its design/plan documentation changed; no contracts/scripts/secrets/environment configuration changed.

- [ ] **Step 3: Open a PR and inspect its workflow runs**

Expected result: only the new `CI`, path-appropriate `Security`, and Dependabot policy (if applicable) run automatically; no `workflow_run` fan-out occurs.
