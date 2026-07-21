# Changelog

All notable changes to **Aetheron Sentinel-L3** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-07-21

### Highlights

Base Mainnet Production Activation & Soft Launch Release

### Added

- Live Base Mainnet Deployment — Deployed and verified `SentinelCore` at `0x2102C76C6528ECf7ebBf5102495d7531E823b6B5`
- On-chain Verification — Verified source code on Sourcify with exact match status
- Automated Evidence Collection — Generated `MAINNET_EVIDENCE_COLLECTION.md` tracking all mainnet deployment artifacts and transaction hashes
- Sentinel Off-Chain Gateway — Operational FastAPI gateway prototype (`sentinel_gateway_prototype.py`) with dry-run support
- Automated AMM Yield & Threat Backtest — Validated impermanent loss bounds (-0.33%) and fee generation ($423.00) in `backtest_amm.py`

---

## [Unreleased] — v0.4.0 Target: August 31, 2026

### Planned

- `feat(security)` Full DeFAI TEE Integration with verifiable execution attestation (#155)
- `feat(governance)` On-chain Agent Governance Policy — binding agent behavior rules via smart contract (#155)
- `feat(security)` Adversarial Testing suite — red-team simulations, MEV vectors, flash-loan governance attacks (#155)
- `feat(agents)` Swap Integration agent v2 — expanded DEX coverage, slippage protection, multi-hop routing
- `fix(ci)` Resolve Dependabot PR CI failures and merge approved dependency updates (#158-#161)
- `docs` CHANGELOG.md added to repo root
- `docs` Sentinel-L3 Unified Dossier v3.1.0 committed to docs/
- `chore` Community visibility push — X/Twitter threads, DEX monitoring, ecosystem channel seeding (#157)

---

## [0.3.0] — 2026-07-12

### Highlights

DeFAI Agents, TEE Security and Mainnet Readiness

### Added

- DeFAI TEE Sandboxing — All DeFAI agent execution now runs inside a Trusted Execution Environment with cryptographic output attestation
- Remix Dashboard (apps/remix-dashboard) — Full-featured operator dashboard with real-time chain state, agent status, and upgrade tracking
- Ethers TypeScript Type Bindings — Auto-generated types from ABI exports; zero manual type maintenance
- Supabase Integration — Off-chain real-time data layer for agent state, telemetry snapshots, and governance event indexing
- Cosmic Echo On-Chain Messaging — Decentralized cross-party messaging anchored on Sentinel-L3 with Base L2 verification
- COMPLETE_EVIDENCE_REPORT.md — Comprehensive mainnet readiness evidence report
- MAINNET_EVIDENCE_PACKET.md — Formal evidence packet for external audit and governance review
- DEPLOYMENT_READINESS_CHECKLIST.md — Production deployment checklist covering all subsystems
- Smart Contract ABIs — Full ABI export pipeline for all production contracts
- Sandbox Testing Environment — Isolated environment for pre-upgrade contract simulation

### Changed

- Upgraded OpenZeppelin contracts to latest audited release
- Telemetry agent sidecar upgraded to Rust 1.78
- Network Atlas epoch snapshot interval reduced from 14400 to 7200 L2 blocks

### Security

- TEE sandboxing applied to all DeFAI agent execution paths
- 856 Snyk alerts triaged: 0 high, 0 critical — 19 low severity only
- Full STRIDE threat model completed (21 threats, CVSS v3.1 + DREAD scored)
- Quarterly red team engagement completed Q2 2026

### Fixed

- Sequencer fallback promotion race condition during Ring 4 upgrade
- Atlas heartbeat flood vulnerability — per-node rate limiting enforced
- Flink cluster OOM on high-cardinality metric burst — auto-scaling added

### Tests

- 365 tests passing across all contract suites
- ABI type bindings integration tests added
- Sandbox environment tests added for pre-upgrade simulation

---

## [0.2.0] — 2026-05-04

### Highlights

CoreLoop Maturity — Governance, Telemetry, and Atlas Production Release

### Added

- Network Atlas — Production release of the authoritative node registry and topology mapper
- Autonomous Upgrade Pipeline (AUP) — Full 5-ring staged rollout model with deterministic execution
- Telemetry System — 8 telemetry streams (STR-001 through STR-008), LSTM + Z-score anomaly scoring engine
- SentinelGovernor.sol — On-chain governance contract deployed on Base Mainnet (Chain ID: 8453)
- TimelockController.sol — 48-hour timelock with SecurityCouncil emergency bypass
- UpgradeRegistry.sol — Content-addressed manifest registry; SHA3-256 hashes registered on-chain
- AuditAnchor.sol — Append-only audit log Merkle root anchoring on Base
- AtlasRegistry.sol — Epoch snapshot registry with 2-of-3 Atlas Aggregator multi-sig validation
- EmergencyCouncil.sol — 4-of-7 multisig emergency governance with post-hoc review requirement
- SPIFFE/SPIRE mTLS — All inter-service communication secured with short-lived SVIDs (24hr rotation)
- Swap Integration Agent — Initial DeFAI swap agent with on-chain governance hooks

### Changed

- Sequencer cluster upgraded to dual-node (primary + fallback) with automatic failover
- Validator ring expanded from 8 to 12 nodes (US-East, US-West, EU-West, AP-Southeast, AP-Northeast)
- AUP ring model expanded from 3 to 5 rings (added Ring 0 devnet shadow + Ring 1 canary)

### Security

- HSM-backed execution keys required for Tier-1 and Tier-2 nodes
- AUP execution key rotation set to 90-day automated ceremony
- Reproducible builds enforced; SBOM published per release
- Bug bounty program activated

### Fixed

- Governance Bridge Adapter event deduplication — prevented double-execution on reorg
- Telemetry aggregator regional failover — added backpressure and per-node rate limiting

---

## [0.1.0] — 2026-03-01

### Highlights

CoreLoop Release — Foundational Protocol Infrastructure

### Added

- Sentinel-L3 Network — Layer 3 rollup on Base Mainnet (OP Stack), Chain ID: 7381
- EVM-compatible execution layer (go-ethereum fork, Cannon fault proof)
- 250ms target block time; soft finality 1-2 blocks; hard finality via Base L2 batch inclusion
- Standard Bridge with Sentinel extensions for L3 to L2 asset transfers
- Initial sequencer node (single, US-East) and validator set (8 nodes)
- Devnet and testnet environments
- hardhat-test.yml, ci.yml, npm-audit.yml CI workflows
- Initial .github/ configuration (issue templates, PR template, contributing guide, security policy)
- legacy_scripts/ migration utilities

### Security

- Initial Snyk integration for dependency vulnerability scanning
- SECURITY.md published with responsible disclosure process

---

## [0.0.1] — 2026-01-15

### Highlights

Aetheron Sentinel — Genesis

### Added

- Initial repository structure
- Project README with architecture overview
- Base Layer 3 rollup concept and initial smart contract scaffolding
- Foundational .github/ structure
- Initial CI skeleton

---

## Links

- [GitHub Repository](https://github.com/MastaTrill/Aetheron-Sentinel-L3)
- [v0.4.0 Milestone](https://github.com/MastaTrill/Aetheron-Sentinel-L3/milestone/1)
- [Bug Bounty](https://github.com/MastaTrill/Aetheron-Sentinel-L3/security)
- [Sentinel-L3 Unified Dossier](./docs/Sentinel-L3-Unified-Dossier.docx)

[Unreleased]: https://github.com/MastaTrill/Aetheron-Sentinel-L3/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/MastaTrill/Aetheron-Sentinel-L3/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/MastaTrill/Aetheron-Sentinel-L3/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MastaTrill/Aetheron-Sentinel-L3/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/MastaTrill/Aetheron-Sentinel-L3/releases/tag/v0.0.1
