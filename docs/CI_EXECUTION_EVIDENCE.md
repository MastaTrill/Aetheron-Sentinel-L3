# CI Execution Evidence Checklist

Use this checklist on every PR to close proof-of-execution gaps.

## Required workflow evidence

1. **PR Testing Claims Guardrail** ran on PR event (`opened`, `edited`, `synchronize`, or `reopened`).
2. **Hardhat CI** produced `aetheronbridge-guardrail-test-log` artifact.
3. **Compile path** either:
   - succeeded normally, or
   - failed with HH502 and emitted remediation guidance from `scripts/compile-contracts.cjs`.

## Required artifacts / links to capture in PR

- Link to workflow run for `.github/workflows/pr-testing-claims.yml`
- Link to workflow run for `.github/workflows/ci.yml`
- Artifact link or screenshot showing `aetheronbridge-guardrail-test-log`
- Compile log snippet proving success or HH502 fail-fast policy output

## Required status checks (repository settings)

Configure branch protection for `main` to require:

- `PR Testing Claims Guardrail / validate-pr-testing-claims`
- `CI / Hardhat (Node 20)`
- `CI / Remix import build`
- `CI / Security Analysis`
- `CI / Gas Usage Analysis`
- `CI / Code Quality`

> Note: required checks are a GitHub repository setting and cannot be enforced purely by source files.
