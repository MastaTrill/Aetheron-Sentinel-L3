# Aetheron Sentinel L3 - Deployment Readiness Checklist

## Pre-Deployment Verification

### Code & Dependencies

- [x] Chainlink import compatibility fixed (AutomationCompatibleInterface)
- [x] All dependency conflicts resolved
- [x] node_modules installed successfully
- [x] No peer dependency warnings
- [x] Contracts compile with solc 0.8.28
- [x] Tests pass on Node.js 22 LTS (`366 passing`)
- [x] Mainnet preflight script reviewed and functional
- [x] Mainnet finalization script reviewed and functional
- [x] Next.js configuration present (production optimizations recommended)

### Environment Preparation

- [x] Node.js set to 22 LTS
- [x] Clean npm install completed
- [x] Test suite runs successfully (`npm test` → `366 passing`)
- [ ] `.env` configured with Sepolia testnet values
- [ ] Sepolia test deployment successful (`npm run deploy:sepolia`)
- [ ] `.env.mainnet` configured with real mainnet values (see MAINNET_CONFIG_GUIDE.md)

### Security & Keys

- [ ] Owner private key secured (not in git, encrypted storage)
- [ ] Deployer account funded with sufficient ETH (~0.5-1 ETH for gas)
- [ ] Multiple relayer addresses configured (minimum 1)
- [ ] Timelock delay configured appropriately (2-7 days recommended)
- [ ] Guardian/multisig addresses configured if using MultiSigVault
- [ ] Token addresses verified on Etherscan
- [ ] RPC endpoint uses HTTPS (not HTTP)

### Infrastructure

- [ ] RPC provider rate limits sufficient for deployment
- [ ] Monitoring/alerting configured for deployed contracts
- [ ] Frontend (Next.js) built and tested: `npm run build:web`
- [ ] Subgraph configuration ready (if using The Graph)
- [ ] Blockexplorer URLs configured (ETHERSCAN_API_KEY set)

## Deployment Sequence

### Phase 1: Testnet Validation (Sepolia)

1. Configure `.env` with Sepolia RPC and test keys
2. Run: `npm run deploy:sepolia`
3. Verify all contracts deployed
4. Test core functions: staking, monitoring, rewards
5. Run: `npm run verify:sepolia` (optional contract verification)
6. Document any issues and fixes

### Phase 2: Mainnet Preflight

1. Configure `.env.mainnet` with production values
2. Run: `npm run mainnet:preflight`
3. **Expected:** `MAINNET PREFLIGHT: PASS`
4. Review all printed values carefully
5. Confirm balances, addresses, chain IDs
6. If fails: fix errors and repeat

### Phase 3: Mainnet Deployment

```bash
npm run deploy:mainnet
```

**During deployment:**

- Monitor terminal output closely
- Save all printed contract addresses immediately
- Do NOT interrupt once started
- Typical time: 5-15 minutes

### Phase 4: Post-Deployment

1. Update `.env.mainnet` with deployed addresses
2. Run: `npm run mainnet:finalize`
3. Fill in actual START_BLOCK when prompted
4. Paste DEPLOYED_ADDRESSES JSON if not auto-filled
5. Generate final summary: `DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md`

### Phase 5: Verification & Production

1. Verify contracts on Etherscan: `npm run verify:mainnet`
2. Deploy subgraph (if used): `npm run update:subgraph`
3. Build frontend: `npm run build:web`
4. Deploy frontend to Vercel/Netlify/AWS
5. Configure monitoring alerts
6. Test production flow end-to-end

## Rollback Plan

If critical issue detected post-deployment:

1. **Pause automated systems:**
   - Set `AUTONOMOUS_MODE=false` via governance (if possible)
   - Or use emergency shutdown functions

2. **Assess impact:**
   - Check if funds at risk
   - Review logs and event emissions
   - Identify root cause

3. **Recovery options:**
   - **Minor issue:** Hotfix deploy via governance
   - **Major issue:** Activate emergency shutdown (if implemented), then plan redeployment
   - **Code bug:** Use upgradeability (if using UUPS/Transparent proxies)

4. **Communicate:**
   - Notify team
   - Post to bug bounty program (if eligible)
   - Prepare incident report

## Success Criteria

✅ All 366 tests pass
✅ Sepolia deployment successful
✅ Mainnet preflight passes all checks
✅ Deployment completes without errors
✅ All contracts verified on Etherscan
✅ Frontend builds and deploys
✅ Monitoring dashboards show healthy state
✅ Team training completed
✅ Runbooks documented

## Emergency Contacts

- **Team Lead:** [Name]
- **On-call Engineer:** [Name/Contact]
- **Security Response:** security@yourproject.io
- **Bug Bounty:** https://immunefi.com/yourproject/

## Documentation Index

- [MAINNET_CONFIG_GUIDE.md](./MAINNET_CONFIG_GUIDE.md) - Detailed .env configuration
- [DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md) - Ownership handover steps
- [DEPLOYMENT_SAFETY_README.md](./DEPLOYMENT_SAFETY_README.md) - Safety procedures

---

**Status:** Ready for Phase 1 (testnet) and mainnet preflight once real environment values are supplied
**Blockers:** Missing `.env` / `.env.mainnet` deployment values, especially `MAINNET_RPC_URL`
**Next Action:** Fill real deployment env values → rerun `npm run mainnet:preflight` → deploy to Sepolia or mainnet per checklist
