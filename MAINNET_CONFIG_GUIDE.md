# Mainnet Deployment Configuration Guide

## Prerequisites

Before configuring `.env.mainnet`, ensure you have:

- ✅ Node.js 22 LTS installed (not v24)
- ✅ All dependencies installed (`npm install`)
- ✅ Hardhat v3 working (`npm test` currently passes)
- ✅ Local test suite passing (`366 passing`)
- ⏳ `.env` / `.env.mainnet` still need real deployment values
- ✅ Real Ethereum mainnet RPC endpoint (Infura, Alchemy, QuickNode, etc.)
- ✅ Owner private key with mainnet ETH for gas fees

## .env.mainnet Configuration

The `.env.mainnet` file contains all required variables for mainnet deployment.

### Required Variables (Must Fill In)

#### 1. RPC & Keys

```
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_ACTUAL_KEY
OWNER_PRIVATE_KEY=0xYOUR_64_HEX_PRIVATE_KEY_HERE
```

**Note:** Private key must be 64 hex characters prefixed with `0x`. Keep this secret!

#### 2. Owner & Control Addresses

```
SENTINEL_OWNER=0xYourOwnerAddressHere
RELAYER_ADDRESSES=0xRelayer1,0xRelayer2,0xRelayer3
CALLER_ADDRESSES=0xCaller1,0xCaller2
MONITOR_ADDRESSES=0xMonitor1,0xMonitor2,0xMonitor3
REPORTER_ADDRESSES=0xReporter1,0xReporter2
SECURITY_REPORTER_ADDRESSES=0xSecReporter1,0xSecReporter2
```

**Format:** Comma-separated list of addresses, no spaces between commas
**Note:** At least one RELAYER_ADDRESS is required (preflight will fail if empty)

#### 3. Token Addresses (Deployed on Mainnet)

```
LP_TOKEN_ADDRESS=0x...
STAKING_TOKEN_ADDRESS=0x...
REWARD_TOKEN_ADDRESS=0x...
YIELD_TOKEN_ADDRESS=0x...
BRIDGE_TOKEN_ADDRESSES=0xToken1,0xToken2
```

**Note:** These are the actual token contract addresses on mainnet. Leave empty if not using that feature yet.

#### 4. Chain Limits (for cross-chain monitoring)

```
TRACKED_CHAIN_IDS=1,8453,42161
CHAIN_LIMITS=1:1000,8453:500,42161:500
```

**Format:** `CHAIN_LIMITS=chainId:limitInETH,chainId:limitInETH`

- `1` = Ethereum Mainnet
- `8453` = Base Mainnet
- `42161` = Arbitrum One
- Adjust limits based on TVL you expect per chain

#### 5. Timelock Governance

```
TIMELOCK_MIN_DELAY=172800
TIMELOCK_PROPOSERS=0xGovernor1,0xGovernor2
TIMELOCK_EXECUTORS=0xExecutor1
TIMELOCK_ADMIN=0xAdminAddress
```

**Note:** If empty, TIMELOCK_ADMIN defaults to SENTINEL_OWNER. TIMELOCK_PROPOSERS/EXECUTORS can be empty (any address can propose/execute if they have the role).

### Optional / Advanced

#### Interceptor Settings

```
ANOMALY_THRESHOLD=10          # Default: 10, min: 0
TVL_THRESHOLD_ETH=1000        # Default: 1000 ETH
AUTONOMOUS_MODE=true         # Default: true (allows auto-actions)
REWARD_PER_SECOND=0          # Default: 0 (manual reward distribution)
```

#### Post-Deployment Verification

```
DEPLOYED_ADDRESSES={"Core":"0x...","Keeper":"0x...",...}
START_BLOCK=0
EXPLORER_BASE_URL=https://etherscan.io/address
```

**Note:** `DEPLOYED_ADDRESSES` will be populated by the deployment script. You can optionally fill manually.

## Validation Steps

### Step 1: Test on Sepolia First

1. Edit `.env` (not `.env.mainnet`) with Sepolia RPC and test keys
2. Run: `npm run deploy:sepolia`
3. Verify deployment works before touching mainnet

### Step 2: Mainnet Preflight Check

```bash
npm run mainnet:preflight
```

**Current status:** This currently fails only because `MAINNET_RPC_URL` is not set to a real mainnet endpoint.

**Expected output:**

```
MAINNET PREFLIGHT: PASS
Network chainId: 1
Latest block: 21924567
Deployer: 0x...
Owner: 0x...
Account balance: 10.5 ETH
Relayers: 0x...
...
```

**Common Errors:**

- `MAINNET_RPC_URL is missing` → Fill in the URL
- `OWNER_PRIVATE_KEY must be a valid 0x-prefixed 32-byte hex key` → Check key format
- `Refusing mainnet preflight on chainId X` → Ensure RPC points to mainnet (chainId 1)
- `SENTINEL_OWNER must be a valid address` → Fix address format
- `RELAYER_ADDRESSES must contain at least one address` → Add at least one relayer

### Step 3: Dry Run (Local Simulation)

```bash
# Use direct_l3 network with local node
npm run deploy:local
```

## Safety Checklist

- [ ] Private key is NOT in any git repo or shared location
- [ ] RPC endpoint uses HTTPS (not HTTP)
- [ ] RPC URL does not contain "YOUR\_" placeholder
- [ ] At least one relayer address is configured
- [ ] Deployer account has sufficient ETH for gas (~0.5-1 ETH recommended)
- [ ] Token addresses are verified on Etherscan
- [ ] ANOMALY_THRESHOLD and TVL_THRESHOLD are set appropriately
- [ ] TIMELOCK_MIN_DELAY is reasonable (2-7 days typical)
- [ ] Have multiple guardian/relayer addresses for redundancy

## Quick Reference: Common Values

```
# Mainnet RPC URLs (replace YOUR_KEY)
Infura:   https://mainnet.infura.io/v3/YOUR_KEY
Alchemy:  https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
QuickNode: https://mainnet.quiknode.pro/v1/YOUR_KEY

# Chain IDs
Ethereum Mainnet: 1
Base Mainnet: 8453
Arbitrum One: 42161
Polygon Mainnet: 137
Optimism: 10

# Typical Timelock Delays
Fast-track: 86400 (1 day)
Standard: 172800 (2 days)
Conservative: 604800 (7 days)
```

## Post-Deployment

After successful deployment:

1. Update `.env.mainnet` with actual deployed addresses from console output
2. Run: `npm run mainnet:finalize` to finalize release notes
3. Verify on Etherscan using `EXPLORER_BASE_URL`
4. Save `DEPLOYED_ADDRESSES_MAINNET.json` for future reference

## Support

If preflight fails:

1. Check all addresses are valid (0x + 40 hex chars)
2. Verify RPC connection: `curl $MAINNET_RPC_URL` (should return JSON)
3. Ensure `MAINNET_RPC_URL` points to Ethereum mainnet (chainId 1)
4. Review `hardhat.config.js` network configuration matches your setup

---

**Last Updated:** 2026-05-11
**Based on:** scripts/mainnet-preflight.cjs validation logic
