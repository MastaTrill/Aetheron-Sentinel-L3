# Test Coverage Summary

## Overview

| Metric | Value |
|--------|-------|
| Total test files | 27 |
| Total test cases | 343 |
| Contracts under test | 27 |
| Test framework | Hardhat 3 + Mocha + Ethers.js |
| CI status | [![CI](https://github.com/MastaTrill/Aetheron-Sentinel-L3/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MastaTrill/Aetheron-Sentinel-L3/actions/workflows/ci.yml) |

## Per-Contract Test Breakdown

| Test File | Tests | Contract |
|-----------|------:|---------|
| `AetheronBridge.test.js` | 7 | `AetheronBridge.sol` |
| `CircuitBreaker.test.js` | 7 | `CircuitBreaker.sol` |
| `SentinelAMM.test.js` | 13 | `SentinelAMM.sol` |
| `SentinelCore.test.js` | 18 | `SentinelCore.sol` |
| `SentinelCoreLoop.test.js` | 7 | `SentinelCoreLoop.sol` |
| `SentinelGovernance.test.js` | 13 | `SentinelGovernance.sol` |
| `SentinelHomomorphicEncryption.test.js` | 5 | `SentinelHomomorphicEncryption.sol` |
| `SentinelInsuranceProtocol.test.js` | 17 | `SentinelInsuranceProtocol.sol` |
| `SentinelInterceptor.test.js` | 4 | `SentinelInterceptor.sol` |
| `SentinelLiquidityMining.test.js` | 21 | `SentinelLiquidityMining.sol` |
| `SentinelMonitor.test.js` | 10 | `SentinelMonitor.sol` |
| `SentinelMultiSigVault.test.js` | 26 | `SentinelMultiSigVault.sol` |
| `SentinelOracleNetwork.test.js` | 23 | `SentinelOracleNetwork.sol` |
| `SentinelPredictiveThreatModel.test.js` | 6 | `SentinelPredictiveThreatModel.sol` |
| `SentinelQuantumGuard.test.js` | 5 | `SentinelQuantumGuard.sol` |
| `SentinelQuantumKeyDistribution.test.js` | 5 | `SentinelQuantumKeyDistribution.sol` |
| `SentinelQuantumNeural.test.js` | 1 | `SentinelQuantumNeural.sol` |
| `SentinelReferralSystem.test.js` | 22 | `SentinelReferralSystem.sol` |
| `SentinelRewardAggregator.test.js` | 21 | `SentinelRewardAggregator.sol` |
| `SentinelSecurityAuditor.test.js` | 6 | `SentinelSecurityAuditor.sol` |
| `SentinelSocialRecovery.test.js` | 28 | `SentinelSocialRecovery.sol` |
| `SentinelStaking.test.js` | 23 | `SentinelStaking.sol` |
| `SentinelTimelock.test.js` | 10 | `SentinelTimelock.sol` |
| `SentinelToken.test.js` | 21 | `SentinelToken.sol` |
| `SentinelYieldMaximizer.test.js` | 12 | `SentinelYieldMaximizer.sol` |
| `SentinelZKIdentity.test.js` | 5 | `SentinelZKIdentity.sol` |
| `SentinelZKOracle.test.js` | 7 | `SentinelZKOracle.sol` |
| **Total** | **343** | |

## Python Unit Tests

| Module | Tests |
|--------|------:|
| `tests/test_orchestration.py` — pause/resume orchestration | 5 |

## Coverage Notes

- Line coverage tooling (`solidity-coverage`) is not yet compatible with Hardhat 3.x — it imports `hardhat/internal/constants` which is not exported in the Hardhat 3 package. Coverage will be enabled once an official Hardhat 3 coverage plugin is released.
- All 343 Solidity tests and 5 Python tests run in CI on every push and PR to `main`.

## CI Configuration

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

- **Hardhat job** (Node 22): `npm ci` → `npm run compile` → `npm test`
- **Python job** (Python 3.11): `python -m unittest discover -s tests -p "test_*.py" -v`
- Concurrency cancellation on redundant runs
