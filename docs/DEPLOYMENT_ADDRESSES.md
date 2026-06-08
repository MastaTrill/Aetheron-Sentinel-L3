# Sentinel L3 — Deployment Addresses

## Base Mainnet (Chain ID: 8453)

### Core Infrastructure

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 1 | SentinelToken | `TBD` | 004_DeploySentinel |
| 2 | SentinelTimelock | `TBD` | 004_DeploySentinel |
| 3 | SentinelGovernance | `TBD` | 004_DeploySentinel |
| 4 | SentinelCore | `TBD` | 001_SentinelCore / 004 |
| 5 | SentinelCoreLoop | `TBD` | 004_DeploySentinel |

### Security Stack

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 6 | SentinelQuantumGuard | `TBD` | 004_DeploySentinel |
| 7 | SentinelInterceptor | `TBD` | 004_DeploySentinel |
| 8 | CircuitBreaker | `TBD` | 004_DeploySentinel |
| 9 | RateLimiter | `TBD` | 004_DeploySentinel |

### Oracle & Auditor

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 10 | SentinelOracleNetwork | `TBD` | 004_DeploySentinel |
| 11 | SentinelSecurityAuditor | `TBD` | 004_DeploySentinel |
| 12 | SentinelMonitor | `TBD` | 004_DeploySentinel |
| 13 | SentinelMultiSigVault | `TBD` | 004_DeploySentinel |

### Yield & Staking

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 14 | SentinelYieldMaximizer | `TBD` | 004_DeploySentinel |
| 15 | SentinelStaking | `TBD` | 004_DeploySentinel |
| 16 | SentinelLiquidityMining | `TBD` | 004_DeploySentinel |
| 17 | SentinelRewardAggregator | `TBD` | 004_DeploySentinel |
| 18 | SentinelReferralSystem | `TBD` | 004_DeploySentinel |

### Bridge

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 19 | AetheronBridge | `TBD` | 002_AetheronBridge / 004 |
| 20 | SentinelLayerZeroBridge | `TBD` | 004_DeploySentinel |
| 21 | SentinelCrossChainSecurityOracle | `TBD` | 004_DeploySentinel |
| 22 | SentinelCrossProtocolStandards | `TBD` | 004_DeploySentinel |

### Insurance

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 23 | SentinelInsuranceProtocol | `TBD` | 004_DeploySentinel |
| 24 | SentinelInsuranceMarketplace | `TBD` | 004_DeploySentinel |
| 25 | SentinelInsurancePool | `TBD` | 004_DeploySentinel |

### Quantum & Privacy

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 26 | SentinelQuantumKeyDistribution | `TBD` | 004_DeploySentinel |
| 27 | SentinelQuantumNeural | `TBD` | 004_DeploySentinel |
| 28 | SentinelHomomorphicEncryption | `TBD` | 004_DeploySentinel |

### ZK & Identity

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 29 | SentinelZKIdentity | `TBD` | 004_DeploySentinel |
| 30 | SentinelSocialRecovery | `TBD` | 004_DeploySentinel |
| 31 | SentinelZKOracle | `TBD` | 004_DeploySentinel |

### Monitors

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 32 | SentinelHeliumMonitor | `TBD` | 004_DeploySentinel |
| 33 | SentinelCompoundMonitor | `TBD` | 004_DeploySentinel |
| 34 | SentinelAxieMonitor | `TBD` | 004_DeploySentinel |

### Keeper & Misc

| # | Contract | Address | Deploy Script |
|---|----------|---------|---------------|
| 35 | SentinelChainlinkKeeper | `TBD` | 003_SentinelChainlinkKeeper / 004 |
| 36 | SentinelSecurityTokenization | `TBD` | 004_DeploySentinel |
| 37 | SentinelPredictiveThreatModel | `TBD` | 004_DeploySentinel |
| 38 | SentinelAPIMarketplace | `TBD` | 004_DeploySentinel |
| 39 | SentinelAMM | `TBD` | 004_DeploySentinel |
| 40 | SentinelUniswapHook | `TBD` | 004_DeploySentinel |
| 41 | SentinelNFTCertification | `TBD` | 004_DeploySentinel |
| 42 | SentinelENSManager | `TBD` | 004_DeploySentinel |

### Libraries & Interfaces

| # | Contract | Address | Notes |
|---|----------|---------|-------|
| 43 | AutomationCompatibleInterface | `TBD` | Chainlink interface (local copy) |
| 44 | LzApp | `TBD` | LayerZero base contract |
| 45 | MockVotes | `TBD` | Testing only — do not deploy to mainnet |
| 46 | ERC20Mock | `TBD` | Testing only — do not deploy to mainnet |
| 47 | ERC20VotesMock | `TBD` | Testing only — do not deploy to mainnet |

---

## Deployment Order

Contracts must be deployed in dependency order:

1. **Phase 1**: Core (Token, Timelock, Governance, Core, CoreLoop)
2. **Phase 2**: Security (QuantumGuard, Interceptor, CircuitBreaker, RateLimiter)
3. **Phase 3**: Oracle (OracleNetwork, SecurityAuditor, Monitor, MultiSigVault)
4. **Phase 4**: Yield (YieldMaximizer, Staking, LiquidityMining, RewardAggregator, Referral)
5. **Phase 5**: Bridge (AetheronBridge, LayerZeroBridge, CrossChainOracle, CrossProtocol)
6. **Phase 6**: AMM (SentinelAMM)
7. **Phase 7**: Insurance (InsuranceProtocol, InsuranceMarketplace)
8. **Phase 8**: Quantum (PredictiveThreat, HomomorphicEnc, QuantumKDF, QuantumNeural)
9. **Phase 9**: ZK (ZKIdentity, SocialRecovery, ZKOracle)
10. **Phase 10**: Keeper + Misc (ChainlinkKeeper, SecurityTokenization, APIMarketplace, etc.)

The `004_DeploySentinel.s.sol` script handles all phases in correct order.

---

## Verification

All contracts are verified on Basescan after deployment:

```
https://basescan.org/address/<CONTRACT_ADDRESS>
```

---

## Post-Deployment Checklist

- [ ] All contract addresses recorded above
- [ ] Contracts verified on Basescan
- [ ] Health checks passed (201, 202)
- [ ] Timelock admin renounced
- [ ] Governance roles granted
- [ ] Monitor authorized for all contracts
- [ ] CoreLoop wired with all components
- [ ] Bridge relayers configured
- [ ] Rate limiter callers configured
- [ ] Interceptor reporters configured
- [ ] Token security reporters configured
- [ ] Initial liquidity provided on DEX
- [ ] Dashboard updated with live addresses
