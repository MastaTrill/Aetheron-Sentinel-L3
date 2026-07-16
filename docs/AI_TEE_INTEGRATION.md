# AI TEE Integration for Sentinel Agents

## Overview
Integrate Trusted Execution Environments (TEEs) for secure AI inference in SentinelL3App and Sentinel L3 core. This protects against prompt injection, model tampering, data poisoning, and ensures verifiable decisions before triggering L3 interceptor contracts.

## Key Components
- **TEE Provider Options**: Phala Cloud (GPU TEEs), Oasis ROFL/ Sapphire (confidential compute), Intel TDX/SGX, or AWS Nitro Enclaves.
- **Attestation Flow**:
  1. AI agent (in SentinelL3App or .agents/skills) runs inside TEE.
  2. Produces remote attestation quote + optional ZK proof of model weights/inference.
  3. On-chain verifier contract (new or extended SentinelQuantumGuard) validates attestation.
  4. Only if valid, L3 contracts (SentinelInterceptor, CircuitBreaker) execute the recommended action (e.g., liquidity drain block, position adjustment).
  5. Fallback: Pure rule-based L3 mode if TEE attestation fails or times out (preserves core security).

## Implementation Steps
1. **Dependencies**: Add to package.json or requirements: `@phala/sdk`, `oasis-rofl`, or equivalent TEE SDKs. For Solidity verifier: integrate with existing DilithiumVerifierWrapper or add TEE attestation verifier.
2. **Agent Skills Update**: Extend `.agents/skills/swap-integration/SKILL.md` and new skills for AI decision engine to output attestation alongside recommendations.
3. **Oracle/Bridge Updates**: Modify oracle.js, bridge-relayer, or SentinelOracleNetwork.sol to include attestation validation before forwarding AI signals.
4. **New Verifier Contract**: Add `TEEAttestationVerifier.sol` that checks quotes against allowlisted TEE measurements (MRENCLAVE etc.).
5. **Testing**: 
   - Local TEE simulation (e.g., with Gramine or Occlum for SGX).
   - End-to-end with Hardhat: mock attestation success/failure.
   - Adversarial tests for attestation forgery.
6. **Deployment**: Update mainnet-pipeline.yml and deploy scripts to include TEE verifier deployment and configuration.

## Security Benefits (DeFAI Context)
- Mitigates prompt injection and adversarial attacks on AI layer.
- Prevents model poisoning from affecting on-chain actions.
- Provides cryptographic proof for AI decisions (auditability, non-repudiation).
- Aligns with quantum-resistant goals (pair with Dilithium).
- Reduces single point of failure: AI can be more autonomous safely.

## Edge Cases & Considerations
- **Latency**: TEE attestation adds ~100ms- few seconds; design async or optimistic execution with rollback.
- **Cost**: Extra gas for verifier; optimize with batching or off-chain proofs with on-chain verification.
- **Key Management**: TEE-sealed keys for agent wallets; integrate with SentinelSocialRecovery or MultiSigVault.
- **Model Updates**: Versioned models with new attestations; governance for updating allowed measurements.
- **Fallback Trust**: Rule-based L3 remains the ultimate security anchor.
- **Regulatory**: Supports audit requirements for AI in finance (EU AI Act high-risk systems).

## Checklist Integration
Add to DEPLOYMENT_READINESS_CHECKLIST.md and DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md under new "AI/DeFAI Security Layer" section.

## Next Actions
- Prototype TEE verifier contract.
- Integrate with existing SentinelL3App (private repo).
- Update Linear AET tasks for TEE implementation.
- Test on Sepolia with mock TEE.

---
*Part of DeFAI security hardening for Aetheron-Sentinel-L3.*