# Sentinel L3 Mainnet Deployment Addresses

## Deployment Script: 003_SentinelChainlinkKeeper.s.sol

### Prerequisites
- Set `OWNER_PRIVATE_KEY` environment variable
- Set `SENTINEL_CORE_ADDRESS` environment variable

### Deploy Command
```bash
forge script script/deploy/003_SentinelChainlinkKeeper.s.sol:SentinelChainlinkKeeperDeploy --rpc-url $BASE_MAINNET_RPC_URL --chain-id 8453 --sender $OWNER_ADDRESS --broadcast --verify --api-key $VERIFY_API_KEY
```

### Contract Addresses (to be filled after deployment)
| Contract | Address | Deployer |
|----------|---------|----------|
| SentinelChainlinkKeeper | *Pending* | *Pending* |
| SentinelCore | *Pending* | *Pending* |

### Post-Deployment Verification
1. Verify contracts on Basescan
2. Update this file with deployed addresses
3. Run health check: `forge script script/health/201_DeploymentHealthCheck.s.sol --rpc-url $BASE_MAINNET_RPC_URL`