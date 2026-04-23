# Aetheron Sentinel L3

Sentinel L3 is a cross-chain security and verification repository built around Solidity contracts, Hardhat automation, Sepolia verification gates, subgraph generation, and a Python orchestration package for BMNR-driven pause and resume flows.

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

## Quick Start

```bash
git clone https://github.com/MastaTrill/Aetheron-Sentinel-L3.git
cd Aetheron-Sentinel-L3
npm ci
```

Compile contracts:

```bash
npm run compile
```

Run the Solidity test suite:

```bash
npm test
```

Run the Python orchestration tests.

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
src/aetheron_sentinel_l3/             Python orchestration package
tests/                                Python unit tests
test/                                 Hardhat test suite
apps/remix-dashboard/                 Dashboard workspace
imports/remix_-aetheron-sentinel-l3/  Remix import workspace
generated/                            Generated subgraph files
logs/verification/                    Verification logs and audit evidence
```

## Documentation

These top-level documents are present in the repository and are the best starting points for deeper context:

- `DOCUMENTATION_INDEX.md`
- `SYSTEM_ARCHITECTURE.md`
- `SECURITY.md`
- `TEST_COVERAGE_SUMMARY.md`
- `DEPLOYMENT_OWNERSHIP_CHECKLIST.md`
- `HARDENING_CERTIFICATION.md`
- `BMNR_INTEGRATION_READINESS.md`
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
