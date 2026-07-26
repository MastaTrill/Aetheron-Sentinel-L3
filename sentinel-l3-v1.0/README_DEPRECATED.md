# Deprecated Duplicate Release Tree

The `sentinel-l3-v1.0/` directory is a historical duplicate of files that also exist at the repository root.

## Rules

- Do not add new production code here.
- Do not use deployment scripts here for Base Sepolia or Base mainnet releases.
- Do not treat addresses, release notes, generated artifacts, or site configuration here as canonical.
- Use the repository root contracts, scripts, configuration, workflows, and documentation.
- Preserve this directory temporarily for comparison and migration only.

## Canonical sources

- Project status: `../PROJECT_STATUS.md`
- Deployment addresses: `../docs/DEPLOYMENT_ADDRESSES.md`
- Release-core configuration: `../config/release-core.json`
- Deployment and verification scripts: `../scripts/`
- Production contracts: `../contracts/`

## Removal gate

This directory may be removed after:

1. unique files are inventoried;
2. any required unique logic is migrated;
3. generated artifacts are confirmed reproducible;
4. CI and deployment scripts no longer reference this directory;
5. a final repository search confirms there are no canonical dependencies on it.
