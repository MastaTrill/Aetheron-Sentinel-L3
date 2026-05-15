# Mainnet Deployment — Quick Execution Checklist

**Status:** READY FOR EXECUTION
**Validated:** 2026-05-15
**RPC:** Alchemy mainnet (chainId 1, block ~25102960)
**Preflight:** PASS

## Prerequisites (do before running any command)

1. Set `OWNER_PRIVATE_KEY` in your shell (hex 0x-prefixed 32-byte key):
   ```powershell
   $env:OWNER_PRIVATE_KEY = "0x<your-key>"
   ```
2. Fund the deployer wallet — gas estimate for all 26 contracts is ~0.1 ETH at current gas prices (~1.875 gwei). With a 40% buffer for post-deploy setup transactions (role grants, bridge config, etc.), **0.14 ETH total** is sufficient. 1 ETH is more than enough for safety.
3. Verify `.env.mainnet` has correct values (already configured)

## Execution Steps

### 1. Compile
```powershell
npm run compile
```
Expected: `Compiled 46 Solidity files with solc 0.8.28`

### 2. Preflight
```powershell
npm run mainnet:preflight | Tee-Object -FilePath .\logs\mainnet-preflight.txt
```
Expected: `MAINNET PREFLIGHT: PASS`

### 3. Deploy
```powershell
npm run deploy:mainnet | Tee-Object -FilePath .\logs\mainnet-deploy.txt
```
Capture the `DEPLOYED_ADDRESSES` JSON from stdout.

### 4. Set deployed addresses in shell
```powershell
$env:DEPLOYED_ADDRESSES = '{"SentinelToken":"0x...",...}'
```

### 5. Ownership setup
```powershell
npm run setup:ownership -- --network mainnet | Tee-Object -FilePath .\logs\mainnet-ownership.txt
```

### 6. Install verify tooling
```powershell
npm run setup:verify-tooling
```

### 7. Etherscan verification
```powershell
npm run verify:mainnet | Tee-Object -FilePath .\logs\mainnet-verify.txt
```

### 8. Regenerate site config
```powershell
$env:EXPLORER_BASE_URL = "https://etherscan.io/address"
$env:NETWORK = "mainnet"
npm run export:site-config
```

### 9. Update subgraph
```powershell
$env:START_BLOCK = "<earliest-deployment-block>"
npm run update:subgraph
```

### 10. Audit checks
```powershell
node scripts/section7-final-sweep.cjs | Tee-Object -FilePath .\logs\section7-final-sweep.txt
node scripts/audit-allowlists.cjs | Tee-Object -FilePath .\logs\audit-allowlists.txt
node scripts/verify-bridge-relayers.cjs | Tee-Object -FilePath .\logs\verify-bridge-relayers.txt
```

### 11. Finalize
```powershell
npm run mainnet:finalize
```

### 12. Update release docs
- `RELEASE_NOTES_MAINNET_2026-04-27.md` — replace all placeholders with tx hashes, blocks, explorer links
- `DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md` — update Final Block and address table
- `docs/MAINNET_RELEASE_PR_CHECKLIST.md` — fill all checkboxes
- `docs/MAINNET_EVIDENCE_CHECKLIST.md` — complete all evidence fields

## Stop Conditions

Do NOT proceed if:
- Preflight fails
- Deployment output lacks complete `DEPLOYED_ADDRESSES` map
- Any ownership setup step fails
- Etherscan verification fails for required contracts
- Any audit script reports unexpected owners/relayers/role members
- `site/contracts.js` still points to Sepolia explorer URLs

## Config Summary

| Setting | Value |
|---------|-------|
| Owner | `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB` |
| Relayer | `0xa4737aa4b1e8a3c8f221be9e55f5bda307ecc1fa` |
| Tracked chains | 1 (Ethereum), 8453 (Base), 42161 (Arbitrum) |
| Chain limits | ETH: 1000, Base: 500, Arbitrum: 500 |
| Timelock delay | 172800s (2 days) |
| Timelock proposers | `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB` |
| Timelock executors | `0x0000...0000` (anyone) |
| Timelock admin | `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB` |
