# AI/DeFAI Layer Additions to Deployment Readiness Checklist

## New Section: AI Security & Governance Layer (for SentinelL3App + core agents)

### Pre-Deployment

- [ ] TEE provider selected and SDK integrated (Phala, Oasis ROFL, etc.)
- [ ] TEEAttestationVerifier contract deployed/tested on target chain
- [ ] Agent autonomy levels defined and enforced in code/governance (see AGENT_GOVERNANCE_POLICY.md)
- [ ] All AI skills in .agents/ reviewed for prompt injection resistance and policy compliance
- [ ] Adversarial test suite passed (new ai-security-test.yml workflow green)
- [ ] Model versions pinned with attestations; update process via governance documented
- [ ] Fallback mechanisms tested (AI failure -> pure L3 rule-based mode)
- [ ] Reasoning traces, confidence scores, and attestation logs integrated with dashboard and on-chain events
- [ ] HITL (human-in-the-loop) approval flows tested for Level 1/2 actions
- [ ] Drift detection and behavioral monitoring active (SentinelMonitor + AI feedback scripts)

### Mainnet Specific

- [ ] TEE measurements (MRENCLAVE etc.) allowlisted in on-chain verifier
- [ ] Agent policy registry or governance module configured with mainnet thresholds
- [ ] Emergency pause/override tested end-to-end (governance + CircuitBreaker + Timelock)
- [ ] AI-related incidents covered in INCIDENT_RESPONSE.md and bug bounty scope
- [ ] Monitoring dashboards include AI health metrics (drift, attestation success rate, escalation volume)
- [ ] Regulatory/compliance evidence prepared (explainability, audit logs) for high-risk AI classification if applicable

### Post-Deployment

- [ ] AI agents monitored for first 48-72h with heightened scrutiny
- [ ] First real-world decisions reviewed; policy tuned if needed
- [ ] Update DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md with AI layer status
- [ ] Quarterly review scheduled for agent governance effectiveness

## Integration Notes

- Merge this into main DEPLOYMENT_READINESS_CHECKLIST.md under a new "## AI/DeFAI Security Layer" heading.
- Cross-link from DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md and LAUNCH_ROADMAP.md.
- Track implementation as Linear AET task or GitHub issue.

**Status**: Recommendations implemented via docs and workflow; full integration and testing in progress.
