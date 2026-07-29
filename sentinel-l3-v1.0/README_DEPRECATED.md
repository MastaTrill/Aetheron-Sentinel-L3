# Retired Duplicate Release Tree

**Status: RETIRED — archive-only, permanently non-canonical**

The `sentinel-l3-v1.0/` directory is a historical duplicate of files that also exist at the repository root. It is not an active release tree and must never be used as a source of production truth.

## Enforced rules

- Do not add production code, fixes, deployment inputs, release evidence, generated addresses, or active configuration here.
- Do not execute contracts, scripts, package commands, workflows, or deployment instructions from this directory.
- Do not use this directory for Base Sepolia or Base Mainnet builds, simulations, verifications, deployments, or upgrades.
- Do not treat addresses, release notes, artifacts, site configuration, ABIs, bytecode, or test output here as canonical.
- Do not create a release tag, package, artifact, or container from this directory.
- Changes inside this tree are limited to deletion, archival metadata, or migration of uniquely required historical material into a canonical root location.

## Canonical sources

- Project status: `../PROJECT_STATUS.md`
- Deployment addresses: `../docs/DEPLOYMENT_ADDRESSES.md`
- Release-core configuration: `../config/release-core.json`
- Deployment and verification scripts: `../scripts/`
- Production contracts: `../contracts/`
- Release evidence: `../release-evidence/`

## Retirement decision

The duplicate tree is retired as of 2026-07-29. Repository validators must fail if active release files depend on it. Its continued presence is only for historical comparison while unique files are inventoried and removed.

## Physical-removal gate

The directory may be deleted after:

1. unique files are inventoried;
2. any required unique logic or evidence is migrated to a canonical root location;
3. generated artifacts are confirmed reproducible from canonical sources;
4. CI, deployment scripts, package scripts, and documentation have no dependency on this directory; and
5. a final repository search confirms no canonical dependency remains.

Retirement is complete even before physical deletion: no release action may rely on this tree.
