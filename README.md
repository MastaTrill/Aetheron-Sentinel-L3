# <p align="center"><img src="assets/logo.svg" alt="Aetheron Sentinel Logo" width="150"></p>

# <p align="center">🛡️ Aetheron Sentinel L3</p>

**Professional Smart Contract Security, AMM Liquidity Management, & Verifiable DeFAI AI Agents.**

<p align="center">
  <a href="docs/HOW_TO_REQUEST_AUDIT.md">![Audit Request](https://img.shields.io/badge/Request-Audit-blue?style=for-the-badge&logo=shield)</a>
  <a href="docs/HOW_TO_BUG_BOUNTY.md">![Bug Bounty](https://img.shields.io/badge/Bug_Bounty-Active-orange?style=for-the-badge&logo=hacken)</a>
  <a href="docs/HOW_TO_CODE_ANALYSIS.md">![Code Analysis](https://img.shields.io/badge/Code_Analysis-Available-brightgreen?style=for-the-badge)</a>
  <a href="docs/AI_TEE_INTEGRATION.md">![DeFAI AI](https://img.shields.io/badge/DeFAI%20AI-TEE%20Verifiable-purple?style=for-the-badge)</a>
</p>

## 📌 Table of Contents

- [Overview](#overview)
- [SENTINEL Deployment Status](#sentinel-deployment-status)
- [🚀 Getting Started](#-getting-started)
- [🛠 Development](#-development)
- [🛡️ Security](#-security)
- [🤖 DeFAI AI Agents & Governance](#-defai-ai-agents--governance)
- [🌐 Community & Support](#-community--support)

## Overview

Aetheron Sentinel L3 is a comprehensive security and automation suite for the SENTINEL ecosystem. It provides automated liquidity management for concentrated liquidity pools, advanced code analysis for smart contracts, a robust security infrastructure, **and verifiable AI agents for DeFAI (Decentralized Finance + AI) with TEE-protected inference and clear autonomy governance**.

### Key Features

- **AMM Strategy Engine**: Dynamic rebalancing with circuit breakers for extreme volatility.
- **Automated Code Analysis**: ML-powered vulnerability scanning and gas optimization.
- **Security Audits**: Professional manual review of smart contract logic and architecture.
- **Bug Bounty Program**: Incentivized community-led security research.
- **Verifiable DeFAI AI Agents**: TEE-secured inference (Phala/Oasis/Intel TDX), attestation flows, policy-enforced autonomy levels (0-3), human-in-the-loop, drift monitoring, and seamless fallback to rule-based L3 security (SentinelInterceptor, CircuitBreaker, quantum guards).

## SENTINEL Deployment Status

A SENTINEL token is deployed on Base Mainnet, but the authoritative release decision
classifies that deployment as **legacy/non-canonical** because control of its 57%
beneficiary has not been proven.

- **Legacy Base Mainnet token:** [`0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`](https://basescan.org/token/0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3)
- **Legacy pool ID:** `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`
- **Current legacy 57% beneficiary:** `0x7e3D11f70084D667295710E6b7FF50C3b0487a45`
- **Intended replacement 57% treasury:** `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`
- **Corrected Base Sepolia rehearsal token:** [`0x3555976fecf045833D6E148C42035170bA1337Ab`](https://sepolia.basescan.org/address/0x3555976fecf045833D6E148C42035170bA1337Ab)
- **Release decision:** [controlled beneficiary redeployment ADR](docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md)
- **Machine-readable status:** [redeployment closure](release-evidence/sentinel-mainnet/redeployment-closure.json)
- **Legacy deployment manifest:** [`deployments/base-mainnet.json`](deployments/base-mainnet.json)
- **Legacy verification:** `BASE_RPC_URL=https://mainnet.base.org bash scripts/verify-canonical-token.sh`

> **Release status:** Replacement preparation only. The corrected Base Sepolia rehearsal is
> complete, but no corrected replacement Base Mainnet token, pool, or deployment
> transaction is recorded. Do not represent the legacy deployment as canonical unless
> the release decision and closure evidence are updated through the required process.

## 🚀 Getting Started

### AMM Liquidity Management

Explore the strategy logic and backtesting tools:

- `amm_strategy.py`: Core liquidity management logic.
- `backtest_amm.py`: Simulation environment for strategy verification.

### Security Services

Detailed guides for our security offerings:

- How to Request an Audit
- How to use Code Analysis
- Bug Bounty Participation

### DeFAI AI Layer

- [AI_TEE_INTEGRATION.md](./docs/AI_TEE_INTEGRATION.md) - TEE integration for secure, verifiable AI decisions.
- [AGENT_GOVERNANCE_POLICY.md](./docs/AGENT_GOVERNANCE_POLICY.md) - Autonomy levels, policies, and enforcement.
- Expanded deployment checklist with AI security section.

## 🛠 Development

The project includes a backtesting utility to simulate market conditions:

```bash
python backtest_amm.py
```

## 🤖 DeFAI AI Agents & Governance

Sentinel L3 now includes a hybrid security model: **core rule-based L3 interceptor + AI-augmented decision layer** protected by Trusted Execution Environments.

- AI agents run in TEEs for tamper-proof inference.
- Cryptographic attestations + optional ZK proofs validated on-chain before actions.
- Clear autonomy tiers with least-privilege, HITL for high-value/novel cases, behavioral monitoring, and immutable audit logs.
- Full fallback to pure L3 mode on any AI/TEE failure.
- New CI workflow for adversarial testing (prompt injection, poisoning, policy bypass).

See the dedicated docs in the Documentation Index for implementation details, integration steps, and mainnet readiness.

## 🌐 Community & Support

- **Dashboard**: Sentinel L3 Dashboard (with new AI health & governance sections)
- **Discussions**: GitHub Discussions
- **Twitter**: @AetherionSentinel

---

**Document Version:** 1.2 (canonical token release controls)  
**Last Updated:** July 26, 2026
