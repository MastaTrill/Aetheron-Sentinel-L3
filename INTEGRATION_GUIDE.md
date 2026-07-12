# Sentinel L3 Integration Guide

## Overview

Sentinel L3 provides an intelligent security overlay for DeFi protocols. Developers can integrate with the Sentinel mesh to benefit from quantum-resistant validation and AI-driven threat mitigation.

## 1. Querying Quantum Guard

To verify if a transaction or identity is quantum-safe:

```solidity
interface ISentinelQuantumGuard {
    function isVerified(address account) external view returns (bool);
}

contract YourProtocol {
    ISentinelQuantumGuard public guard;

    function sensitiveAction() external {
        require(guard.isVerified(msg.sender), "Identity not quantum-secure");
        // logic
    }
}
```

## 2. Using the Sentinel Interceptor

The Interceptor can act as a middleware to block anomalous transactions:

```solidity
function executeWithProtection(address target, bytes calldata data) external {
    uint256 score = interceptor.getAnomalyScore(target, data);
    require(score < threshold, "Sentinel: High Anomaly Detected");
    // execution
}
```

## 3. APY Metrics Integration

Query the `SentinelYieldMaximizer` for real-time strategy performance to display in your own UI.
