# DEX Liquidity Provision Strategy

## Overview

This document outlines the strategy for providing $SENT liquidity on decentralized exchanges to enable trading, price discovery, and ecosystem growth.

---

## Phase 1: Initial Liquidity Bootstrapping

### Target DEX: Uniswap V3 (Base Network)

Uniswap V3 is the optimal initial venue due to:

- Deepest TVL on Base network
- Concentrated liquidity efficiency
- Integration with SentinelAMM hook for security-enhanced pools
- Composability with existing DeFi protocol

### Initial Pool Configuration

| Parameter             | Value                                          |
| --------------------- | ---------------------------------------------- |
| **Pool Pair**         | SENT / WETH                                    |
| **Fee Tier**          | 0.3% (standard)                                |
| **Initial Price**     | Determined by market discovery                 |
| **Liquidity Range**   | ±20% around initial price                      |
| **Initial Liquidity** | From Ecosystem Fund allocation (250M SENT max) |

### SENT/USDC Standard Pair (Phase 1b)

| Parameter           | Value                                           |
| ------------------- | ----------------------------------------------- |
| **Pool Pair**       | SENT / USDC                                     |
| **Fee Tier**        | 0.3% (standard)                                 |
| **Liquidity Range** | ±20% around market discovery price              |
| **Purpose**         | Standard onboarding for USDC-based participants |

---

## Phase 2: Liquidity Mining Incentives

### SentinelLiquidityMining Rewards

Deploy liquidity mining programs to bootstrap pool depth:

| Pool      | weekly Reward | Reward Source               | Duration |
| --------- | ------------- | --------------------------- | -------- |
| SENT/ETH  | 200,000 SENT  | Liquidity Mining allocation | 12 weeks |
| SENT/USDC | 100,000 SENT  | Liquidity Mining allocation | 12 weeks |

### Boost Multipliers

| LP Position Size         | Boost Multiplier |
| ------------------------ | ---------------- |
| < 10,000 SENT equivalent | 1.0x             |
| 10,000 – 50,000          | 1.25x            |
| 50,000 – 200,000         | 1.5x             |
| > 200,000                | 2.0x             |

---

## Phase 3: Cross-Chain Liquidity Expansion

### LayerZero Bridge Integration

Deploy SENT to additional chains via SentinelLayerZeroBridge:

- **Ethereum Mainnet**: Primary security and liquidity layer
- **Arbitrum**: Low-cost trading with Ethereum security
- **Polygon**: Retail accessibility and micro-transactions

### Bridge Fee Revenue

Cross-chain transfers generate fees that flow back to stakers:

- Base fee: 0.1% of transfer amount
- Dynamic adjustment based on destination chain congestion
- Fees distributed via SentinelRewardAggregator

---

## Liquidity Risk Management

### Impermanent Loss Protection

SentinelInsuranceProtocol offers IL protection for LPs:

- Coverage up to 80% of IL losses
- Premium: 0.5% of position value per month
- Claim trigger: IL exceeds 5% of position

### Circuit Breaker

SentinelCircuitBreaker integration protects against extreme events:

- Trading pauses if price moves > 15% in 5 minutes
- Automatic pool rebalancing via SentinelAMM
- Guardian intervention for manual override

### Slippage Controls

- Maximum transaction size: 1% of pool depth
- Progressive fee for large orders (> 0.5% of pool)
- Rate limiting via SentinelRateLimiter

---

## Treasury Management (Ecosystem Fund)

The 250M SENT Ecosystem Fund is managed by governance:

### Fund Allocation

| Category      | Allocation | Amount    |
| ------------- | ---------- | --------- |
| DEX Liquidity | 40%        | 100M SENT |
| CEX Listings  | 20%        | 50M SENT  |
| Partnerships  | 20%        | 50M SENT  |
| Reserve       | 20%        | 50M SENT  |

### Liquidity Rebalancing

Governance votes on:

- Adding/removing liquidity pairs
- Adjusting fee tiers
- Allocating liquidity mining rewards
- Emergency liquidity withdrawal (timelocked)

---

## Legal & Compliance

- No guaranteed returns — APY figures are projections based on protocol activity
- Users must conduct their own due diligence
- Insurance coverage is subject to policy terms and claim verification
- Governance decisions are executed via timelock with community oversight
