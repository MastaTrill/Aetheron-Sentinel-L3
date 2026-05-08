# Mainnet Operator Runbook

This runbook is the single execution path for an operator performing the live mainnet deployment from this repository.

## Prerequisites

- Windows PowerShell session opened at the repo root.
- `.env.mainnet` reviewed locally and kept out of version control.
- Mainnet signer funded for deployment gas.
- Multisig signers available if ownership or timelock actions are not executed directly by the deployer.

## Required Environment Variables

Set these before running any command:

```powershell
$env:MAINNET_RPC_URL = "https://<your-mainnet-rpc>"
$env:OWNER_PRIVATE_KEY = "0x<32-byte-private-key>"
$env:SENTINEL_OWNER = "0x<final-owner-or-multisig>"
$env:RELAYER_ADDRESSES = "0x<relayer1>[,0x<relayer2>]"
```

Set these when they apply to your deployment:

```powershell
$env:TIMELOCK_ADMIN = "0x<timelock-admin-or-multisig>"
$env:MONITOR_ADDRESSES = "0x<monitor1>[,0x<monitor2>]"
$env:REPORTER_ADDRESSES = "0x<reporter1>[,0x<reporter2>]"
$env:SECURITY_REPORTER_ADDRESSES = "0x<security-reporter1>[,0x<security-reporter2>]"
$env:TRACKED_CHAIN_IDS = "1,8453,42161"
$env:BRIDGE_TOKEN_ADDRESSES = "0x<token1>[,0x<token2>]"
$env:CHAIN_LIMITS = "1:1000,8453:500,42161:500"
$env:STAKING_TOKEN_ADDRESS = "0x<staking-token>"
$env:REWARD_TOKEN_ADDRESS = "0x<reward-token>"
$env:YIELD_TOKEN_ADDRESS = "0x<yield-token>"
$env:LP_TOKEN_ADDRESS = "0x<liquidity-mining-lp-token>"
$env:REWARD_PER_SECOND = "0"
$env:TIMELOCK_PROPOSERS = "0x<proposer1>[,0x<proposer2>]"
$env:TIMELOCK_EXECUTORS = "0x0000000000000000000000000000000000000000"
$env:TIMELOCK_MIN_DELAY = "172800"
```

## Operator Sequence

### 1. Install Dependencies

```powershell
npm ci --legacy-peer-deps
```

### 2. Compile Contracts

```powershell
npm run compile
```

### 3. Validate Mainnet Configuration Without Sending Transactions

```powershell
npm run mainnet:preflight | Tee-Object -FilePath .\logs\mainnet-preflight.txt
```

Expected result: `MAINNET PREFLIGHT: PASS`

### 4. Execute Mainnet Deployment

```powershell
npm run deploy:mainnet | Tee-Object -FilePath .\logs\mainnet-deploy.txt
```

Action after command completes:

- Copy the emitted `DEPLOYED_ADDRESSES` JSON from stdout.
- Set it in the current shell for all subsequent steps.

```powershell
$env:DEPLOYED_ADDRESSES = '{"SentinelToken":"0x...","AetheronBridge":"0x..."}'
```

### 5. Execute Ownership and Post-Deploy Configuration

If the deployer is also the final owner and the deploy script already performed owner-only setup, verify the output before skipping this step.

Otherwise run:

```powershell
npm run setup:ownership -- --network mainnet | Tee-Object -FilePath .\logs\mainnet-ownership.txt
```

If ownership is controlled by a multisig, execute the printed pending actions via Safe and capture the Safe transaction links in the PR checklist.

### 6. Install Verify Tooling

```powershell
npm run setup:verify-tooling
```

### 7. Submit Mainnet Source Verification

```powershell
npm run verify:mainnet | Tee-Object -FilePath .\logs\mainnet-verify.txt
```

### 8. Regenerate Public Site Contract Config

```powershell
$env:EXPLORER_BASE_URL = "https://etherscan.io/address"
$env:NETWORK = "mainnet"
npm run export:site-config
```

### 9. Update Subgraph Addresses and Start Block

Set the earliest deployment block from the deployment receipts:

```powershell
$env:START_BLOCK = "<earliest-mainnet-deployment-block>"
npm run update:subgraph
```

### 10. Run Read-Only Onchain Audit Checks

```powershell
node scripts/section7-final-sweep.cjs | Tee-Object -FilePath .\logs\section7-final-sweep.txt
node scripts/audit-allowlists.cjs | Tee-Object -FilePath .\logs\audit-allowlists.txt
node scripts/verify-bridge-relayers.cjs | Tee-Object -FilePath .\logs\verify-bridge-relayers.txt
```

### 11. Finalize Release Metadata

```powershell
npm run mainnet:finalize
```

### 12. Fill the PR Checklist and Release Docs

- Update [docs/MAINNET_RELEASE_PR_CHECKLIST.md](./MAINNET_RELEASE_PR_CHECKLIST.md)
- Update [docs/MAINNET_EVIDENCE_CHECKLIST.md](./MAINNET_EVIDENCE_CHECKLIST.md)
- Update [RELEASE_NOTES_MAINNET_2026-04-27.md](../RELEASE_NOTES_MAINNET_2026-04-27.md)
- Update [DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md](../DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md)

## Stop Conditions

Do not publish the mainnet release if any of the following is true:

- `npm run mainnet:preflight` fails
- Deployment output does not include a complete `DEPLOYED_ADDRESSES` map
- Ownership handoff or Safe role actions are incomplete
- `npm run verify:mainnet` fails for required contracts
- Any read-only audit script reports unexpected owners, relayers, callers, or role members
- [site/contracts.js](../site/contracts.js) still points to Sepolia explorer URLs
