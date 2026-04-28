# Deployment Ownership Checklist (Mainnet)

This checklist is adapted for mainnet deployment, following the validated Sepolia workflow. All privileged paths must terminate at your mainnet multisig or explicitly approved production service accounts only.

## 1. Deploy With Explicit Ownership

Deploy all contracts with your final mainnet owner address as the constructor `initialOwner` argument (see .env.mainnet):

- Use multisig or hardware-wallet-controlled admin account for all Ownable contracts.
- For contracts using OpenZeppelin Governor, ensure TimelockController is the authority and grant all roles to your multisig before revoking deployer admin.

## 2. Bridge Authorization

- Call `setRelayer(relayerAddress, true)` for each mainnet relayer you control.
- Do not grant `RELAYER_ROLE` directly unless required.
- Call `setTokenSupport(token, true)` and `setChainLimit(chainId, limit)` only for approved assets/chains.

## 3. Rate Limiter Authorization

- Call `setCaller(bridgeAddress, true)` and only add other callers you control.
- Configure each chain with `setChainLimit()` and `setChainResetPeriod()`.

## 4. Monitoring Authorization

- Grant `MONITOR_ROLE` and `OPERATOR_ROLE` only to dedicated monitoring wallets.
- Revoke any temporary or deployer monitor accounts before production.

## 5. Yield and Token Setup

- Configure yield strategies and security reporters only for trusted mainnet accounts.
- Verify all admin roles point to your intended mainnet admin account.

## 6. Ownership Rotation Safety

- Use `transferOwnership(newOwner)` as needed, then verify all roles and allowlists.

## 7. Final Verification

- Verify all Ownable contracts report your mainnet admin as owner.
- All relayer/caller/reporter addresses are mainnet-controlled.
- All admin/distributor roles point to approved mainnet addresses.
- Timelock admin/proposer/canceller roles are held by your multisig.
- No temporary deployer account retains privileged roles.

## 8. Post-Deploy Verification Automation

- Export ABIs and verify source on Etherscan.
- Run all verification scripts with mainnet addresses.

## 9. CoreLoop Bootstrap

- Use atomic initialization for critical components.
- Update site/subgraph config with mainnet addresses after deployment.

## 10. Live Status Snapshot (Mainnet)

- Source of truth: [site/contracts.js](./site/contracts.js) and mainnet Etherscan.
- Rerun this checklist before go-live.

## 11. Timelock Realignment Calls (Mainnet)

- Use Safe UI or direct calls to grant/revoke roles as per Section 12 in Sepolia checklist, but with mainnet addresses.

## 12. Release Documentation

- Attach all verification outputs and transaction records to mainnet release PR.

---

## Last Updated

April 27, 2026
