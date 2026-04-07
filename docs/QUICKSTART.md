# Quick Start Guide - Aetheron Sentinel L3

## Prerequisites

- Node.js 18+
- npm or yarn
- Git

## Installation

```bash
# Clone the repository
git clone https://github.com/aetheron/sentinel-l3.git
cd sentinel-l3

# Install dependencies
npm install
```

## Configuration

```bash
# Copy environment file
cp .env.example .env

# Edit with your settings
notepad .env  # or your preferred editor
```

Edit `.env` with:
- RPC URL (Alchemy, Infura, etc.)
- Private key (with funds for deployment)
- Etherscan API key (for verification)

## Development

### Start Local Node

```bash
# Terminal 1: Start Hardhat node
npm run node
```

### Deploy Locally

```bash
# Terminal 2: Deploy contracts
npm run deploy:local
```

### Run Tests

```bash
# All tests
npm test

# Specific contract
npx hardhat test test/SentinelInterceptor.test.ts
```

### Compile Contracts

```bash
npm run compile
```

## Testing the Sentinel

### Manual Test Scenario

1. **Deploy contracts** (see above)

2. **Check initial status:**
```javascript
const sentinel = await ethers.getContractAt("SentinelInterceptor", SENTINEL_ADDRESS);
const [isPaused, tvl, autonomous] = await sentinel.getSecurityStatus();
console.log("Paused:", isPaused, "TVL:", tvl, "Autonomous:", autonomous);
```

3. **Simulate TVL spike:**
```javascript
// Report 15.2% TVL spike (triggers auto-pause)
await sentinel.connect(oracle).reportAnomaly(1520, ethers.parseEther("1000000"));
```

4. **Verify pause:**
```javascript
const [isPaused] = await sentinel.getSecurityStatus();
console.log("Bridge protected:", isPaused);
```

### Response Metrics

```javascript
const [detect, exec, total] = await sentinel.getResponseMetrics();
console.log(`Detection: ${detect}ms, Execution: ${exec}ms, Total: ${total}ms`);
```

## Using the Bridge

### Bridge Tokens

```javascript
const bridge = await ethers.getContractAt("AetheronBridge", BRIDGE_ADDRESS);
const token = await ethers.getContractAt("ERC20", TOKEN_ADDRESS);

// Approve tokens
await token.approve(BRIDGE_ADDRESS, amount);

// Bridge request
const request = {
    token: TOKEN_ADDRESS,
    amount: amount,
    destinationChain: 1,  // Ethereum mainnet
    recipient: "0x...",   // Recipient address
    maxSlippage: 50,      // 0.5%
    deadline: 0
};

await bridge.bridge(request, { value: ethers.parseEther("0.001") });
```

### Complete Bridge (Relayer)

```javascript
// Relayer completes the bridge on destination chain
await bridge.connect(relayer).completeBridge(
    transferId,
    tokenAddress,
    amount,
    recipient
);
```

## Quantum-Resistant Features

### Register Guardian

```javascript
const vault = await ethers.getContractAt("QuantumResistantVault", VAULT_ADDRESS);

// Add guardian (admin only)
await vault.addGuardian(guardianAddress);
```

### Initiate Quantum Escape

```javascript
// Time-locked escape (24 hour delay)
await vault.connect(guardian).initiateQuantumEscape(
    targetAddress,
    data,
    value
);
```

### Confirm Escape

```javascript
// After 24 hours, confirm with threshold guardians
await vault.connect(guardian).confirmTimeLockedOp(opHash);
```

## Monitoring

### Start Anomaly Detection Service

```bash
cd services/anomaly-detection
npm install
npm run dev
```

### Deploy Forta Bot

```bash
cd forta
npm install
forta-agent deploy
```

## Deployment

### Testnet (Sepolia)

```bash
npm run deploy:sepolia
```

### Mainnet

```bash
# 1. Verify all tests pass
npm test

# 2. Compile with optimization
npm run compile

# 3. Deploy
npx hardhat run scripts/deploy.ts --network mainnet

# 4. Verify on Etherscan
npx hardhat verify --network mainnet <ADDRESS>
```

## Common Issues

### "Insufficient funds"

Ensure your deployer account has enough ETH for gas.

### "Contract not verified"

Run `npx hardhat verify --network <network> <address>` after deployment.

### "Role assignment failed"

Ensure you're using the correct role hash when granting.

## Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture
- Read [API.md](API.md) for complete API reference
- Review contracts in `/contracts`
- Check out `/test` for usage examples

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/aetheron/sentinel-l3/issues)
- Discord: [Join](https://discord.gg/aetheron)
