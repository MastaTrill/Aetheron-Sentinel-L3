'use strict';
/**
 * scripts/tee-attestation-stub.cjs
 *
 * DeFAI TEE Attestation Engine & On-Chain Anchoring
 * ────────────────────────────────────────────────────────────────────────────
 * Standardized interface that produces schema-compliant TEEAttestationEnvelope
 * records and supports on-chain cryptographic anchoring via AuditAnchor.sol.
 *
 * Schema compatibility: matches the `TEEAttestationEnvelope` format defined
 * in docs/TEE_INTEGRATION.md §3.1 & §3.2.
 */

const crypto = require('node:crypto');

const STUB_VERSION = '0.5.0-defai';
const REAL_TEE_AVAILABLE = process.env.TEE_HARDWARE_MODE === 'true';

const AUDIT_ANCHOR_ABI = [
  'function recordHash(bytes32 envelopeHash) external',
  'function recordHashBatch(bytes32[] calldata hashes) external',
  'function isHashAnchored(bytes32 envelopeHash) external view returns (bool)',
];

/**
 * Derive a deterministic mock PCR0 measurement from the agent context.
 */
function _mockMeasurement(context) {
  return crypto
    .createHash('sha256')
    .update(`${STUB_VERSION}:${JSON.stringify(context)}`)
    .digest('hex');
}

/**
 * Create an open attestation envelope (before action execution).
 *
 * @param {object} context - Action context to attest.
 * @returns {object} Open attestation envelope.
 */
function createAttestation(context) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const openedAt = new Date().toISOString();

  return {
    schemaVersion: 1,
    mode: REAL_TEE_AVAILABLE ? 'tee-hardware' : 'stub',
    stubVersion: STUB_VERSION,
    nonce,
    openedAt,
    context: { ...context },
    tee: {
      platform: REAL_TEE_AVAILABLE ? 'intel-tdx' : 'stub',
      measurement: _mockMeasurement({ ...context, nonce }),
      mrenclave: null,
      mrsigner: null,
      quote: null,
      collateral: null,
    },
    status: 'open',
    result: null,
    closedAt: null,
  };
}

/**
 * Finalize an attestation envelope after the action has completed.
 *
 * @param {object} envelope  - The open envelope returned by createAttestation.
 * @param {object} result    - Action result (e.g., { status, txHash }).
 * @returns {object} Finalized (closed) attestation envelope.
 */
function finalizeAttestation(envelope, result) {
  const closedAt = new Date().toISOString();
  const finalEnvelope = {
    ...envelope,
    result,
    status: result.status === 'confirmed' ? 'confirmed' : result.status,
    closedAt,
    envelopeHash: null,
  };

  const hashInput = JSON.stringify({
    nonce: finalEnvelope.nonce,
    openedAt: finalEnvelope.openedAt,
    context: finalEnvelope.context,
    result: finalEnvelope.result,
    closedAt: finalEnvelope.closedAt,
  });

  finalEnvelope.envelopeHash = '0x' + crypto.createHash('sha256').update(hashInput).digest('hex');
  return finalEnvelope;
}

/**
 * Anchor an attestation envelope hash on-chain via AuditAnchor.sol.
 *
 * @param {object} envelope  - Finalized attestation envelope.
 * @param {object} signer    - ethers.js signer connected to RPC.
 * @param {string} anchorAddress - AuditAnchor contract address.
 * @param {object} ethersLib - ethers library instance.
 */
async function anchorOnChain(envelope, signer, anchorAddress, ethersLib) {
  if (!envelope || !envelope.envelopeHash) {
    throw new Error('Cannot anchor incomplete or unhashed envelope');
  }

  if (!anchorAddress || !signer) {
    return {
      anchored: false,
      reason: 'dry-run-or-no-signer',
      envelopeHash: envelope.envelopeHash,
    };
  }

  try {
    const ethers = ethersLib || require('ethers');
    const anchor = new ethers.Contract(anchorAddress, AUDIT_ANCHOR_ABI, signer);
    const tx = await anchor.recordHash(envelope.envelopeHash);
    const receipt = await tx.wait();
    return {
      anchored: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      envelopeHash: envelope.envelopeHash,
    };
  } catch (err) {
    return {
      anchored: false,
      error: err.message,
      envelopeHash: envelope.envelopeHash,
    };
  }
}

module.exports = {
  createAttestation,
  finalizeAttestation,
  anchorOnChain,
  REAL_TEE_AVAILABLE,
  AUDIT_ANCHOR_ABI,
};
