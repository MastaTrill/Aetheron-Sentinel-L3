# Deployment Results

## Local Hardhat Network (for development/testing)

**Sentinel Interceptor**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
**Aetheron Bridge**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`

## Testnet Deployment Status

- **Sepolia**: RPC timeout issues - unable to connect
- **Amoy**: Insufficient funds (0.0135 ETH balance, ~0.37 ETH needed)

## Next Steps

1. Get testnet funds for Amoy or use alternative RPC endpoints
2. Deploy security modules using `deploy-complete-security-suite.ts`
3. Update subgraph configuration
4. Deploy subgraph
5. Configure and deploy dashboard

## Environment Variables for Dashboard

```bash
VITE_SENTINEL_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
VITE_BRIDGE_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
VITE_NETWORK=hardhat
```
