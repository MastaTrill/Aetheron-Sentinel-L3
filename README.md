# Aetheron Sentinel L3

Sentinel L3 is a cross-chain security and verification repository built around Solidity contracts, Hardhat automation, Sepolia verification gates, subgraph generation, and Python telemetry modules.

## Repository Scope

This repository includes:

- Solidity contracts under `contracts/` for bridge controls, governance, staking, monitoring, and automated response flows
- Hardhat-based scripts under `scripts/` for deployment, verification, ownership checks, exports, and audits
- A Python package under `src/aetheron_sentinel_l3/` with unit tests in `tests/`
- The Graph subgraph sources in `schema.graphql`, `subgraph.yaml`, and `generated/`
- Remix-related workspaces in `apps/remix-dashboard/` and `imports/remix_-aetheron-sentinel-l3/`
- CI and nightly verification workflows under `.github/workflows/`

## Requirements

- Node.js 22+
- npm 10+
- Python 3.11+
- Git

## Public Dashboard

- The [Remix Dashboard](./apps/remix-dashboard/) is now public. Monitoring, bug bounty stats, and live metrics are available.

## Mainnet Deployment & Onboarding

**Mainnet is now the current deployment target.**

- See [DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md](DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md) for the mainnet deployment summary and addresses.
- See [DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md](DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md) for mainnet verification and handoff steps.
- See [RELEASE_NOTES_MAINNET_2026-04-27.md](RELEASE_NOTES_MAINNET_2026-04-27.md) for the mainnet release record.
- For mainnet deployment workflow, use [MAINNET_PREPARATION_TEMPLATE.md](MAINNET_PREPARATION_TEMPLATE.md).

## Secret Management & Environment Variables

**Never commit real secrets or private keys to the repository.**

- All sensitive values (private keys, API tokens, credentials) must be provided via environment variables.
- Use the provided `.env.example` as a template—copy it to `.env` or `.env.mainnet` and fill in your own values locally.
- For deployment and ownership automation, set `OWNER_PRIVATE_KEY` and other secrets in your environment, not in code or scripts.
- For mainnet, use `.env.mainnet` and review all values before deployment.
- See [DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md](DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md) for secure deployment and handoff instructions.
- For frontend/API keys, use `.env.local` or similar, never commit real keys.

**Warning:** Commits containing secrets will be rejected by push protection and secret scanning.

## Quick Start (Mainnet)

## Security, Audit, and Incident Response

- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md): Formal incident response plan
- [SECURITY_AUDIT.md](./SECURITY_AUDIT.md): Third-party audit status
- [BUG_BOUNTY.md](./BUG_BOUNTY.md): Bug bounty program details

```bash
git clone https://github.com/MastaTrill/Aetheron-Sentinel-L3.git
cd Aetheron-Sentinel-L3
npm ci
cp .env.example .env.mainnet
# Edit .env.mainnet with your mainnet values
```

Compile contracts:

```bash
npm run compile
```

Run the Solidity test suite:

```bash
npm test
```

PowerShell:

```powershell
$env:PYTHONPATH="src"
python -m unittest discover -s tests -p "test_*.py" -v
```

Bash:

```bash
PYTHONPATH=src python -m unittest discover -s tests -p "test_*.py" -v
```

Build the subgraph artifacts:

```bash
npm run codegen
npm run build
```

Build the dashboard workspace:

```bash
npm run dashboard:build
```

## Artifact Publishing & Monitoring

### ABI Publishing

ABIs are exported to the `abis/` directory via `npm run export:all-abis` and uploaded as a GitHub Actions artifact in CI. You can publish these to npm, a CDN, or other destinations as needed.

### Advanced Monitoring

For advanced monitoring and alerting, consider integrating with OpenZeppelin Defender or Forta. See their documentation for setup and best practices.

---

## Fuzz Testing (Echidna)

Fuzz testing for Solidity contracts is supported via [Echidna](https://github.com/crytic/echidna). Install Echidna (requires Docker or native build), then run:

```bash
echidna-test ./contracts --config echidna.yaml
```

See `echidna.yaml` for configuration and contract selection. Write Solidity property-based tests using `assert` or `echidna_*` functions. See the Echidna documentation for advanced usage.

## Common Commands

### Deploy and Verify

```bash
npm run deploy:local
npm run deploy:sepolia
npm run deploy:mainnet
npm run verify:testnet
npm run verify:mainnet
npm run setup:ownership
```

### Verification and Audit Scripts

```bash
node scripts/section7-final-sweep.cjs
node scripts/audit-allowlists.cjs
node scripts/verify-bridge-relayers.cjs
npm audit
```

### Exports and Subgraph

```bash
npm run export:abis
npm run export:site-config
npm run update:subgraph
npm run codegen
npm run build
```

### Dashboard Workspace

```bash
npm run dashboard:dev
npm run dashboard:lint
npm run dashboard:build
```

## CI and Automation

The main CI workflow in `.github/workflows/ci.yml` runs:

- Hardhat compile and test on Node 22
- Python unit tests on Python 3.11
- Sepolia verification gate scripts
- subgraph code generation and build
- Remix import workspace lint and build

The nightly and manual verification workflow in `.github/workflows/post-deploy-nightly-verification.yml` runs:

- Sepolia ownership sweep
- allowlist audit
- bridge relayer verification
- npm dependency audits for the root workspace and both Remix workspaces

## Project Layout

```text
contracts/                            Solidity contracts
scripts/                              Deploy, verify, export, and audit scripts
src/aetheron_sentinel_l3/             Python telemetry package
tests/                                Python unit tests
test/                                 Hardhat test suite
apps/remix-dashboard/                 Dashboard workspace
imports/remix_-aetheron-sentinel-l3/  Remix import workspace
generated/                            Generated subgraph files
logs/verification/                    Verification logs and audit evidence
```

## Badges

![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)
![Docs](https://img.shields.io/badge/docs-coverage-100%25-brightgreen)
![Build](https://github.com/MastaTrill/Aetheron-Sentinel-L3/actions/workflows/lint.yml/badge.svg)
![Audit](https://github.com/MastaTrill/Aetheron-Sentinel-L3/actions/workflows/audit.yml/badge.svg)

## Documentation

These top-level documents are present in the repository and are the best starting points for deeper context:

- `DOCUMENTATION_INDEX.md`
- `SYSTEM_ARCHITECTURE.md`
- `SECURITY.md`
- `TEST_COVERAGE_SUMMARY.md`
- `DEPLOYMENT_OWNERSHIP_CHECKLIST.md`
- `HARDENING_CERTIFICATION.md`
- `RELEASE_SUMMARY_2026-04-23.md`

## Security

Security reporting guidance lives in `SECURITY.md`.

For routine local verification, run:

```bash
npm test
npm audit
```

For Python validation, run the unit tests with `PYTHONPATH=src` set as shown above.

## Contributing

Open an issue or pull request in this repository for proposed changes. If the change affects deployment, verification, security posture, or ownership state, include the relevant command output or workflow evidence in the pull request description.

## License

This project is marked `UNLICENSED` in `package.json`.
