'use strict';
/**
 * scripts/validate-tee-attestation.cjs
 *
 * Validates cryptographic integrity of a TEEAttestationEnvelope JSON file or object.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Envelope must be a non-null object');
  }

  if (envelope.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${envelope.schemaVersion}`);
  }

  if (!envelope.nonce || typeof envelope.nonce !== 'string' || envelope.nonce.length < 16) {
    throw new Error('Invalid or missing nonce');
  }

  if (!envelope.openedAt || !envelope.closedAt) {
    throw new Error('Envelope is missing openedAt or closedAt timestamps');
  }

  if (!envelope.context || typeof envelope.context !== 'object') {
    throw new Error('Envelope context is missing or invalid');
  }

  const hashInput = JSON.stringify({
    nonce: envelope.nonce,
    openedAt: envelope.openedAt,
    context: envelope.context,
    result: envelope.result,
    closedAt: envelope.closedAt,
  });

  const expectedHash = '0x' + crypto.createHash('sha256').update(hashInput).digest('hex');

  if (envelope.envelopeHash !== expectedHash) {
    throw new Error(
      `Envelope hash mismatch! Expected ${expectedHash}, found ${envelope.envelopeHash}`
    );
  }

  return {
    valid: true,
    envelopeHash: expectedHash,
    mode: envelope.mode,
    status: envelope.status,
  };
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: node scripts/validate-tee-attestation.cjs <envelope.json>');
    process.exit(0);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const res = validateEnvelope(content);
  console.log('TEE Attestation Envelope: VALID');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { validateEnvelope };
