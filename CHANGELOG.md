# Changelog

All notable changes to Sentinel L3 will be documented here.

## [1.0.0] — Mainnet Release Preparation

### Added

- Mainnet release package, operator runbooks, and deployment evidence checklists
- Completed Sepolia rehearsal deployment reflected across the current public release packet
- 27-contract production deployment plan including:
  - Core execution layer (SentinelCore, CoreLoop, AMM)
  - Security mesh (CircuitBreaker, RateLimiter, Interceptor, QuantumGuard, ZKIdentity, etc.)
  - Governance stack (Governance, Timelock, MultiSigVault)
  - Economic layer (Token, Staking, YieldMaximizer, ReferralSystem, InsuranceProtocol)
  - Observability layer (OracleNetwork, Monitor, SecurityAuditor)
- Complete ABI bundle
- Deployment registry + checksums
- Governance genesis file
- Explorer metadata pack
- Developer SDK (TypeScript)
- Full documentation suite:
  - Whitepaper v1.0
  - Activation Guide
  - Architecture Overview
  - Security Precheck
  - Governance Genesis
- Visual architecture diagrams (Mermaid)
- Hybrid Foundry + Hardhat development environment

### Security

- Mainnet deployment now requires `OWNER_PRIVATE_KEY` to be supplied from the shell instead of `.env.mainnet`
- Governance release flow is documented around timelock + multisig handoff
- CircuitBreaker and RateLimiter remain part of the default release topology

### Notes

This entry reflects mainnet release preparation and Sepolia-backed deployment evidence in the repository. Final mainnet release notes remain blocked on objective Ethereum mainnet transaction evidence.
