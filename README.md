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
- [Canonical SENTINEL Token](#canonical-sentinel-token)
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

## Canonical SENTINEL Token

The canonical Aetheron Sentinel L3 ecosystem token is deployed on Base Mainnet:

- **Contract:** [`0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`](https://basescan.org/token/0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3)
- **Network:** Base Mainnet (`8453`)
- **On-chain name/symbol:** `SENTINEL` / `SENTINEL`
- **Deployment manifest:** [`deployments/base-mainnet.json`](deployments/base-mainnet.json)
- **Security and governance plan:** [`docs/SENTINEL_TOKEN_MAINNET.md`](docs/SENTINEL_TOKEN_MAINNET.md)
- **Verification:** `BASE_RPC_URL=https://mainnet.base.org bash scripts/verify-canonical-token.sh`

> **Release status:** Canonical, pending governance hardening and launch evidence. The separate `contracts/SentinelToken.sol` design is not the verified source for this deployed address and must not be represented as the live token.

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
