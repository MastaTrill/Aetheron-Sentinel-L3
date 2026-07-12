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

## AI / DeFAI Security Layer (NEW - SentinelL3App + Core Agents)

### Pre-Deployment AI Verification
- [ ] TEE provider selected and SDKs integrated (Phala Cloud, Oasis ROFL/Sapphire, Intel TDX, etc.)
- [ ] TEEAttestationVerifier contract (or extension to SentinelQuantumGuard / DilithiumVerifierWrapper) deployed and tested
- [ ] Agent autonomy levels (0-3) defined, coded, and enforced via governance/policy engine (see AGENT_GOVERNANCE_POLICY.md)
- [ ] All .agents/skills and SentinelL3App AI components reviewed for prompt injection resistance, policy compliance, and adversarial robustness
- [ ] New adversarial test suite passed (ai-security-test.yml workflow green; prompt injection, poisoning, attestation forgery, policy bypass tests)
- [ ] Model versions pinned with cryptographic attestations; model update/governance process documented
- [ ] Fallback mechanisms fully tested (AI/TEE failure → pure rule-based L3 mode via SentinelCoreLoop / CircuitBreaker)
- [ ] Reasoning traces, confidence scores, attestation quotes, and decision logs integrated with dashboard (Sentinel Gateway) and on-chain events
- [ ] Human-in-the-loop (HITL) approval flows tested for Level 1/2 actions (dashboard reasoning board + sovereign handshake)
- [ ] Behavioral monitoring, drift detection, and anomaly escalation active (SentinelMonitor + ai-feedback-loop.js + SentinelPredictiveThreatModel)

### Mainnet AI-Specific
- [ ] TEE measurements (MRENCLAVE, etc.) allowlisted and verified in on-chain TEE verifier contract
- [ ] Agent policy registry / governance module configured with mainnet thresholds, value limits, and escalation rules
- [ ] Emergency pause/override tested end-to-end (governance vote → Timelock → CircuitBreaker → SentinelCoreLoop downgrade of AI agents)
- [ ] AI-specific incidents, model failures, and attestation issues covered in INCIDENT_RESPONSE.md and bug bounty scope
- [ ] Production monitoring dashboards include dedicated AI health section (attestation success rate, drift score, escalation volume, confidence distribution)
- [ ] Regulatory/compliance evidence package prepared (explainability traces, audit logs, human oversight records) — especially relevant if classified as high-risk AI under frameworks like EU AI Act

### Post-Deployment AI Monitoring
- [ ] AI agents run under heightened monitoring for first 48-72 hours (or first N real decisions)
- [ ] First production AI decisions reviewed by team; policy or thresholds tuned if needed
- [ ] Update DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md and FINAL_STATUS_REPORT.md with AI layer status and evidence
- [ ] Quarterly governance review of DeFAI agent effectiveness, incidents, and policy updates scheduled

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
3. **SECURITY GATE:** Run `npm run verify:ownership` to audit control plane
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
- [AI_TEE_INTEGRATION.md](./docs/AI_TEE_INTEGRATION.md) - TEE for AI agents
- [AGENT_GOVERNANCE_POLICY.md](./docs/AGENT_GOVERNANCE_POLICY.md) - Autonomy levels & policies

---

**Status:** Ready for Phase 1 (testnet) and mainnet preflight once real environment values are supplied. AI/DeFAI layer docs and workflow added; full TEE integration and adversarial testing in active development.
**Blockers:** Missing `.env` / `.env.mainnet` deployment values, especially `MAINNET_RPC_URL`. AI layer requires TEE SDK prototyping and verifier contract.
**Next Action:** Fill real deployment env values → rerun `npm run mainnet:preflight` → deploy to Sepolia or mainnet per checklist. Track AI security tasks in Linear (AET project).

---
_For more information on our security practices, see SECURITY.md and the new DeFAI security docs._
