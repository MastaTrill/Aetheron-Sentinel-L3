# DeFAI TEE Integration Architecture

**Status:** Design accepted (v0.4.0) — Implementation target: v0.5.0
**Last updated:** 2026-08-09

---

## 1. Overview

Sentinel L3 DeFAI agents execute autonomous on-chain actions (swaps, liquidity, governance votes).
To provide verifiable execution guarantees to counterparties and auditors, every agent action must
be accompanied by a cryptographically attested **TEE Attestation Envelope** — a tamper-evident
record proving that the action was computed inside a Trusted Execution Environment (TEE) and that
the code measurement matches the published source.

The attestation chain is:

```
DeFAI Agent (inside TEE)
  └─ computes action parameters
  └─ calls TEE attestation SDK → gets hardware Quote (TDX/SGX)
  └─ wraps Quote in TEEAttestationEnvelope
  └─ submits on-chain transaction
  └─ anchors envelopeHash to AuditAnchor.sol
```

---

## 2. Threat Model

| Threat | Mitigation |
|---|---|
| Agent runs modified code | TEE MRENCLAVE measurement pinned to published artifact |
| Attestation report is forged | Quote signed by hardware root key; verified off-chain via Intel PCS |
| Replay attack on old attestation | Nonce + timestamp in envelope; on-chain deduplication |
| TEE keys extracted | Memory encryption + sealed storage; HSM-backed sealing keys |
| Action parameters tampered | Parameters hashed into PCR0 measurement before quote |
| On-chain anchor not submitted | Monitoring agent checks anchor within N blocks of action |

---

## 3. Data Schemas

### 3.1 TEEAttestationEnvelope (JSON)

```jsonc
{
  "schemaVersion": 1,
  "mode": "tee-hardware",      // "stub" in v0.4.0, "tee-hardware" from v0.5.0
  "nonce": "<16-byte hex>",    // anti-replay
  "openedAt": "<ISO-8601>",    // before action execution
  "context": {
    "agentId": "<uint256 string>",
    "action": "swap",           // swap | multi_swap | liquidity | bridge | governance | emergency
    "tokenIn": "0x...",
    "tokenOut": "0x...",
    "amountIn": "1.5",
    "slippagePct": 0.5,
    "dryRun": false
    // ... action-specific parameters
  },
  "tee": {
    "platform": "intel-tdx",   // intel-tdx | intel-sgx | amd-sev
    "measurement": "<sha256>", // SHA-256 of (stubVersion:context:nonce) in stub mode
    "mrenclave": "<hex>",      // MRENCLAVE register (null in stub)
    "mrsigner": "<hex>",       // MRSIGNER register (null in stub)
    "quote": "<base64>",       // raw TDX ECDSA Quote (null in stub)
    "collateral": {
      "tcbInfo": "...",
      "qeIdentity": "...",
      "certificate": "..."
    }
  },
  "status": "confirmed",       // open | confirmed | failed | dry-run
  "result": {
    "status": "confirmed",
    "txHash": "0x..."
  },
  "closedAt": "<ISO-8601>",
  "envelopeHash": "0x<sha256>" // SHA-256 of (nonce, openedAt, context, result, closedAt)
}
```

### 3.2 On-chain Anchor (AuditAnchor.sol)

```solidity
// Existing AuditAnchor.sol call pattern (v0.5.0):
auditAnchor.recordHash(bytes32(envelopeHash));
```

The Merkle root of all anchored hashes is emitted as an event and stored on Base L2
for independent verification.

---

## 4. Quote Verification Flow (v0.5.0)

```
1. Agent produces envelopeHash (SHA-256 of signed action context).
2. Agent requests a TDX Quote from the TEE platform SDK.
3. Quote contains: envelopeHash in reportData field.
4. Quote is submitted to Intel Provisioning Certification Service (PCS) via:
     GET https://api.trustedservices.intel.com/tdx/certification/v4/...
5. Collateral (TCB Info, QE Identity, Certificate chain) is cached locally.
6. Verifier (off-chain or on-chain via DCAP contract) validates:
     a. Quote signature against TDX key
     b. MRENCLAVE matches published measurement
     c. TCB level meets minimum bar
     d. reportData == sha256(envelopeHash)
7. If valid, envelopeHash is anchored on-chain.
```

---

## 5. Implementation Plan (v0.5.0)

### Dependencies
- Intel TDX Attestation SDK (C library + node-addon)
- `@gramine-project/tdx-attestation` npm package (or custom binding)
- Updated `AuditAnchor.sol` with Merkle root accumulator

### Files to create / modify

| File | Change |
|---|---|
| `scripts/tee-attestation-stub.js` | Replace `_mockMeasurement` with SDK call |
| `scripts/tee-attestation-stub.js` | Implement `anchorOnChain()` |
| `contracts/SentinelAuditLedger.sol` | Add `recordHashBatch(bytes32[])` for efficiency |
| `scripts/tee-verifier.js` | Off-chain quote verifier (CI gate) |
| `.github/workflows/tee-attestation.yml` | CI workflow to run verifier against evidence |
| `docs/TEE_SETUP.md` | Operator guide for provisioning TEE hardware |

### Milestones
- [ ] TEE hardware provisioned (Azure DCsv3 or GCP C3 Confidential VM)
- [ ] TDX SDK bindings tested locally
- [ ] `tee-attestation-stub.js` → real implementation
- [ ] `AuditAnchor.sol` updated + tests
- [ ] CI quote verification pipeline
- [ ] v0.5.0 release with full TEE evidence on Base Mainnet

---

## 6. Current State (v0.4.0)

The TEE attestation stub (`scripts/tee-attestation-stub.js`) is wired into `swap-agent-v2.js`
and produces full schema-compliant envelopes with `mode: "stub"`. The `envelopeHash` is
computed correctly and can be anchored on-chain manually. The `tee.quote` field is `null`
in stub mode and must not be presented as a real attestation.

All DeFAI agents should import `createAttestation` / `finalizeAttestation` from the stub
so that upgrading to the real implementation in v0.5.0 requires only a single file swap.
