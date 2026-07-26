# Sentinel L3 — Automated Gas Benchmark Report

**Generated:** `2026-07-26T10:50:09.073Z`
**Network:** Base Mainnet (Chain ID: 8453)
**Gas Price Assumption:** 0.002 gwei (Base L2)
**Contracts Benchmarked:** 8
**Functions Analyzed:** 17

---

## ⛽ Gas Usage by Contract & Function

| Contract | Function | Gas Units | Classification | Est. ETH Cost |
|---|---|---|---|---|
| `SentinelCore` | `analyzeThreat` | 48,250 | 🟢 LOW | 0.00000010 ETH |
| `SentinelCore` | `triggerCircuitBreaker` | 33,100 | 🟢 LOW | 0.00000007 ETH |
| `SentinelToken` | `transfer` | 51,800 | 🟡 MEDIUM | 0.00000010 ETH |
| `SentinelToken` | `approve` | 46,400 | 🟢 LOW | 0.00000009 ETH |
| `SentinelToken` | `transferFrom` | 63,200 | 🟡 MEDIUM | 0.00000013 ETH |
| `SentinelStaking` | `stake` | 125,000 | 🟠 HIGH | 0.00000025 ETH |
| `SentinelStaking` | `unstake` | 98,000 | 🟡 MEDIUM | 0.00000020 ETH |
| `SentinelStaking` | `claimRewards` | 87,000 | 🟡 MEDIUM | 0.00000017 ETH |
| `SentinelVaultStrategy` | `deposit` | 94,500 | 🟡 MEDIUM | 0.00000019 ETH |
| `SentinelVaultStrategy` | `withdraw` | 82,100 | 🟡 MEDIUM | 0.00000016 ETH |
| `SentinelVaultStrategy` | `rebalanceStrategy` | 71,300 | 🟡 MEDIUM | 0.00000014 ETH |
| `SentinelAuditLedger` | `recordProof` | 68,400 | 🟡 MEDIUM | 0.00000014 ETH |
| `SentinelAMM` | `swap` | 115,000 | 🟠 HIGH | 0.00000023 ETH |
| `SentinelAMM` | `addLiquidity` | 142,000 | 🟠 HIGH | 0.00000028 ETH |
| `SentinelGovernance` | `propose` | 287,000 | 🔴 VERY HIGH | 0.00000057 ETH |
| `SentinelGovernance` | `castVote` | 58,000 | 🟡 MEDIUM | 0.00000012 ETH |
| `SentinelQuantumGuard` | `verifyDilithiumSignature` | 195,000 | 🟠 HIGH | 0.00000039 ETH |


---

## 📊 Summary
- ✅ **4 contracts** have all functions under 100,000 gas.
- ⚠️  Functions exceeding 200,000 gas (quantum signature verification) are expected due to cryptographic complexity.
- 💡 Base L2 gas costs are approximately **10-50x cheaper** than Ethereum Mainnet.

---
*Generated automatically by Sentinel L3 Gas Benchmark Engine.*
