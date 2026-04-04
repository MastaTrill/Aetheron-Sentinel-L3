# Aetheron Sentinel L3 - API Reference

## SentinelInterceptor.sol

### View Functions

#### `getSecurityStatus()`
Returns current security status.

```typescript
function getSecurityStatus() external view returns (
    bool isPaused,
    uint256 currentTVL,
    bool isAutonomous
);
```

**Returns:**
- `isPaused`: Whether the interceptor is paused
- `currentTVL`: Current total value locked
- `isAutonomous`: Whether autonomous mode is enabled

#### `getResponseMetrics()`
Returns response time metrics.

```typescript
function getResponseMetrics() external pure returns (
    uint256 detectionLatencyMs,
    uint256 executionLatencyMs,
    uint256 totalInterceptTimeMs
);
```

**Returns:** `[4, 10, 14]` - Detection, execution, and total intercept times in milliseconds

---

### Transaction Functions

#### `reportAnomaly(tvlPercentage, currentTVL)`
Report an anomaly from the oracle.

```typescript
function reportAnomaly(
    uint256 tvlPercentage,
    uint256 currentTVL
) external onlyRole(ORACLE_ROLE) whenNotPaused;
```

**Parameters:**
- `tvlPercentage`: TVL withdrawal percentage in basis points (e.g., 1520 = 15.20%)
- `currentTVL`: Current total value locked

**Events:** `AnomalyDetected`, `AutonomousPauseTriggered`

#### `emergencyPause(reason)`
Manually trigger emergency pause.

```typescript
function emergencyPause(
    string calldata reason
) external onlyRole(SENTINEL_ROLE) whenNotPaused;
```

#### `resumeBridge(newTVL)`
Resume bridge operations after review.

```typescript
function resumeBridge(
    uint256 newTVL
) external onlyRole(SENTINEL_ROLE) whenPaused;
```

**Parameters:**
- `newTVL`: Updated TVL after security review

#### `updateTVL(newTVL)`
Update the tracked TVL.

```typescript
function updateTVL(
    uint256 newTVL
) external onlyRole(ORACLE_ROLE);
```

---

## AetheronBridge.sol

### View Functions

#### `getBridgeStats()`
Returns bridge statistics.

```typescript
function getBridgeStats() external view returns (
    bool paused,
    uint256 supportedChainCount,
    uint256 fee
);
```

#### `isTransferCompleted(transferId)`
Check if a transfer has been completed.

```typescript
function isTransferCompleted(
    bytes32 transferId
) external view returns (bool);
```

---

### Transaction Functions

#### `bridge(request)`
Bridge tokens to another chain.

```typescript
struct BridgeRequest {
    address token;           // Token to bridge
    uint256 amount;          // Amount to bridge
    uint256 destinationChain; // Target chain ID
    address recipient;        // Recipient on destination
    uint256 maxSlippage;      // Max slippage in basis points
    uint256 deadline;         // Transaction deadline
}

function bridge(
    BridgeRequest calldata request
) external payable whenNotPaused nonReentrant returns (bytes32 transferId);
```

**Parameters:**
- `request`: Bridge request parameters

**Returns:** `transferId` - Unique identifier for the transfer

**Events:** `TokensBridged`

#### `completeBridge(transferId, token, amount, recipient)`
Complete a bridge transfer (relayer only).

```typescript
function completeBridge(
    bytes32 transferId,
    address token,
    uint256 amount,
    address recipient
) external onlyRole(RELAYER_ROLE) nonReentrant;
```

#### `emergencyPause()`
Emergency pause (sentinel only).

```typescript
function emergencyPause() external onlyRole(SENTINEL_ROLE) whenNotPaused;
```

#### `setSupportedChain(chainId, supported)`
Enable or disable a chain.

```typescript
function setSupportedChain(
    uint256 chainId,
    bool supported
) external onlyRole(DEFAULT_ADMIN_ROLE);
```

---

## QuantumResistantVault.sol

### View Functions

#### `getSecurityInfo()`
Returns comprehensive security information.

```typescript
function getSecurityInfo() external view returns (
    uint256 securityLevel,
    uint256 guardianCount,
    uint256 threshold,
    uint256 lastRotation,
    uint256 nextRotation
);
```

#### `getGuardians()`
Returns list of guardian addresses.

```typescript
function getGuardians() external view returns (address[] memory);
```

---

### Transaction Functions

#### `submitQuantumSecure(target, data, value, sig)`
Submit a quantum-resistant signature.

```typescript
struct QuantumSignature {
    bytes classicalSig;       // ECDSA component
    bytes32 hashCommitment;   // HTSS commitment
    uint256 timestamp;        // Timelock component
    bytes32 domainSeparator; // Domain binding
}

function submitQuantumSecure(
    address target,
    bytes calldata data,
    uint256 value,
    QuantumSignature calldata sig
) external onlyRole(GUARDIAN_ROLE) whenNotPaused;
```

#### `initiateQuantumEscape(target, data, value)`
Initiate time-locked emergency escape.

```typescript
function initiateQuantumEscape(
    address target,
    bytes calldata data,
    uint256 value
) external onlyRole(GUARDIAN_ROLE) whenNotPaused;
```

**Note:** 24-hour time lock before execution is possible.

#### `confirmTimeLockedOp(opHash)`
Confirm a pending time-locked operation.

```typescript
function confirmTimeLockedOp(
    bytes32 opHash
) external onlyRole(GUARDIAN_ROLE);
```

#### `rotateQuantumKey(newCommitment)`
Rotate quantum key commitments.

```typescript
function rotateQuantumKey(
    bytes32 newCommitment
) external onlyRole(QUANTUM_ADMIN_ROLE);
```

**Note:** Minimum 90 days since last rotation required.

#### `quantumThreatResponse(reason)`
Emergency response to quantum threat.

```typescript
function quantumThreatResponse(
    string calldata reason
) external onlyRole(GUARDIAN_ROLE) whenNotPaused;
```

---

## RateLimiter.sol

### View Functions

#### `getWindowStats()`
Returns current rate limit window statistics.

```typescript
function getWindowStats() external view returns (
    uint256 windowRemaining,
    uint256 amountUsed,
    uint256 limit
);
```

#### `getAverageWindowAmount()`
Returns average withdrawal across last 10 windows.

```typescript
function getAverageWindowAmount() external view returns (uint256);
```

---

### Transaction Functions

#### `setChainLimit(chainId, limit)`
Set withdrawal limit for specific chain.

```typescript
function setChainLimit(
    uint256 chainId,
    uint256 limit
) external onlyRole(MANAGER_ROLE);
```

---

## HashBasedSignatures.sol

### View Functions

#### `computeMerkleRoot(leaves)`
Compute Merkle root from leaves.

```typescript
function computeMerkleRoot(
    bytes32[] memory leaves
) external pure returns (bytes32 root);
```

#### `generateAuthPath(leaves, leafIdx)`
Generate authentication path for a leaf.

```typescript
function generateAuthPath(
    bytes32[] memory leaves,
    uint256 leafIdx
) external pure returns (bytes32[] memory authPath);
```

---

### Transaction Functions

#### `registerSigner(signer, merkleRoot, leafCount)`
Register a signer with their public key tree.

```typescript
function registerSigner(
    address signer,
    bytes32 merkleRoot,
    uint256 leafCount
) external onlyRole(DEFAULT_ADMIN_ROLE);
```

#### `verify(messageHash, signature, signer, rootIndex)`
Verify a hash-based signature.

```typescript
function verify(
    bytes32 messageHash,
    bytes calldata signature,
    address signer,
    uint256 rootIndex
) external view returns (bool);
```

---

## CircuitBreaker.sol

### View Functions

#### `getState()`
Returns current circuit state.

```typescript
function getState() external view returns (State, uint256);
```

**States:** `CLOSED (0)`, `OPEN (1)`, `HALF_OPEN (2)`

#### `getStats()`
Returns detailed circuit breaker statistics.

```typescript
function getStats() external view returns (
    State state,
    uint256 failures,
    uint256 successes,
    uint256 timeSinceChange,
    uint256 untilReset
);
```

---

## Role Constants

| Role | Hash | Description |
|------|------|-------------|
| `DEFAULT_ADMIN_ROLE` | `0x00` | Full admin access |
| `SENTINEL_ROLE` | `keccak256("SENTINEL_ROLE")` | Emergency pause access |
| `ORACLE_ROLE` | `keccak256("ORACLE_ROLE")` | Anomaly reporting |
| `RELAYER_ROLE` | `keccak256("RELAYER_ROLE")` | Bridge completion |
| `GUARDIAN_ROLE` | `keccak256("GUARDIAN_ROLE")` | Quantum vault access |
| `UPGRADER_ROLE` | `keccak256("UPGRADER_ROLE")` | UUPS upgrades |

---

## Events Reference

### SentinelInterceptor

| Event | Parameters |
|-------|------------|
| `AnomalyDetected` | `tvlPercentage`, `threshold`, `timestamp` |
| `AutonomousPauseTriggered` | `trigger`, `tvlAtPause`, `duration` |
| `ThresholdUpdated` | `oldThreshold`, `newThreshold` |
| `AutonomousModeToggled` | `enabled` |
| `TVLUpdated` | `oldTVL`, `newTVL` |

### AetheronBridge

| Event | Parameters |
|-------|------------|
| `TokensBridged` | `sender`, `token`, `amount`, `destinationChain`, `recipient`, `transferId` |
| `TokensUnbridged` | `recipient`, `token`, `amount`, `transferId` |
| `TransferCompleted` | `transferId` |

### QuantumResistantVault

| Event | Parameters |
|-------|------------|
| `GuardianAdded` | `guardian` |
| `GuardianRemoved` | `guardian` |
| `OperationInitiated` | `opHash`, `target`, `executeAfter` |
| `OperationExecuted` | `opHash` |
| `QuantumAlert` | `reason` |
| `KeyRotated` | `newCommitment`, `timestamp` |
