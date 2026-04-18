# Sepolia Deployment Runbook for BMNR Testnet Backfill

This runbook exists to unblock PR #10 and Issue #11 by producing the real contract addresses and deployment blocks needed to replace the placeholders in `subgraph/subgraph.yaml`.

## Goal

Capture verified Sepolia deployment values for:
- `SentinelInterceptor`
- `AetheronBridge`
- `RateLimiter`
- `CircuitBreaker`
- deployment block(s)

## Required environment

Populate the following values before deploying:

```bash
export SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
export DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
export ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

Optional / recommended values from `.env.example`:

```bash
export TREASURY_ADDRESS=0x...
export RELAYER_ADDRESS=0x...
export ORACLE_ADDRESS=0x...
export SUPPORTED_CHAINS=1,10,42161
```

## Install + compile

```bash
npm install
npm run compile
```

## Step 1: deploy core contracts to Sepolia

```bash
npm run deploy:sepolia
```

Record the output values from the deploy script:
- `SentinelInterceptor`
- `AetheronBridge`

The core deploy script logs these addresses directly.

## Step 2: deploy security modules to Sepolia

Export the Sentinel address from step 1:

```bash
export SENTINEL_ADDRESS=0xYOUR_SENTINEL_ADDRESS
npm run deploy:security:sepolia
```

Record the output values from the security deploy script and identify:
- anomaly oracle
- exploit forecast oracle
- any linked security-module addresses needed operationally

If `RateLimiter` and `CircuitBreaker` are deployed by a different path, record those addresses from the corresponding deploy command / receipt and add them below.

## Step 3: capture deployment blocks

For each contract, record the transaction hash and deployment block from the Sepolia explorer or receipt.

Template:

```text
SentinelInterceptor:
- address:
- tx hash:
- deployment block:

AetheronBridge:
- address:
- tx hash:
- deployment block:

RateLimiter:
- address:
- tx hash:
- deployment block:

CircuitBreaker:
- address:
- tx hash:
- deployment block:
```

## Step 4: patch the subgraph

Replace the placeholders in `subgraph/subgraph.yaml`:
- contract addresses
- `startBlock` values

Recommended rule:
- use the exact deployment block for each contract when known
- if multiple contracts are deployed together and exact values are unavailable, use the earliest verified deployment block shared by the group

## Step 5: validate

After patching the subgraph config:

```bash
# build / deploy subgraph using the project’s standard graph workflow
# then validate event ingestion for:
# - AnomalyDetected
# - AutonomousPauseTriggered
# - WithdrawalProcessed
# - CircuitOpened / CircuitClosed
```

## Exit criteria

PR #10 is ready to leave draft when:
1. all placeholder addresses are replaced
2. all `startBlock` values are replaced
3. subgraph indexing is validated on Sepolia
4. CI matrix (including `tests.test_orchestration`) passes
