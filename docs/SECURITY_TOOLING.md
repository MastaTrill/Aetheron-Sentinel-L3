# Aetheron Sentinel L3 — Security Tooling

This document describes the security controls wired into CI and recommended operational follow-ups.

## Already in place (pre-existing)

| Control | Workflow / location |
|---------|---------------------|
| Slither (fail on high) | `security.yml`, `enterprise-security-slither.yml` |
| npm production audit | `security.yml`, `npm-audit.yml` |
| Dependency review (PR) | `npm-audit.yml` |
| CodeQL / SARIF upload | Slither SARIF → GitHub code scanning |
| Hardhat + gas + threat-model scripts | `sentinel-security-audit.yml` |

## Added in this change set

| Control | Workflow / config |
|---------|-------------------|
| **Gitleaks** secret scanning | `.github/workflows/security-supply-chain.yml` + `.gitleaks.toml` |
| **OSV-Scanner** | same workflow |
| **pip-audit** (Python) | same workflow |
| **Trivy** filesystem scan (CRITICAL/HIGH → SARIF) | same workflow |
| **Semgrep** SAST (default + OWASP + custom) | `.github/workflows/semgrep.yml` + `.semgrep/bridge-security.yaml` |
| **Echidna** property fuzz scaffolding | `.github/workflows/echidna-fuzz.yml` + `contracts/test/EchidnaInterceptorProperties.sol` |

## Custom Semgrep rules (bridge-focused)

File: `.semgrep/bridge-security.yaml`

- Hardcoded private key / secret patterns
- Unchecked low-level `.call`
- `tx.origin` authorization
- Untrusted `delegatecall`
- Missing access-control hints on public state changers

## Echidna next steps

1. Replace placeholder state in `contracts/test/EchidnaInterceptorProperties.sol` with real `SentinelInterceptor` + `RateLimiter` + `CircuitBreaker` deployment.
2. Encode invariants:
   - No unauthorized liquidity drain
   - Pause blocks outbound value
   - Rate limit cannot be exceeded within window
3. Raise `testLimit` in `echidna.yaml` for nightly runs.
4. Flip the Echidna workflow from soft-skip to **fail on property violation** once properties are real.

## Operational recommendations (not automated here)

| Tool | Why |
|------|-----|
| OpenZeppelin Defender / Tenderly | On-chain anomaly alerts for drains, pauses, large transfers |
| Forta custom bot | Community + custom detection for bridge attack patterns |
| Mythril / MythX | Periodic symbolic execution on interceptor + vault |
| Socket.dev / Phylum | Stronger npm malware / supply-chain signals |
| Sentry / OTel | Runtime error + trace for off-chain dashboard/API |

## Dependabot posture

- Security and patch bumps are merged aggressively.
- **Major** upgrades require human review before merge:
  - OpenZeppelin contracts 3 → 5 (`#200`)
  - vite 6 → 8 (`#192`)
  - torch major (`#163`)
  - mlflow pre-release (`#279`)

## Enabling stricter gates

Once noise is under control:

1. Set Trivy / OSV `exit-code: 1` for CRITICAL on `main`.
2. Require Gitleaks + Semgrep + Slither as required status checks on `main`.
3. Enable Echidna fail-on-break for interceptor properties.
