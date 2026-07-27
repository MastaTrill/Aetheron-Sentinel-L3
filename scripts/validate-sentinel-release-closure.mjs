#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg?.split('=')[1] ?? 'readiness';
if (!['readiness', 'final'].includes(mode)) throw new Error('Use --mode=readiness or --mode=final');

const manifestPath = process.env.SENTINEL_RELEASE_CLOSURE_MANIFEST ?? 'release-evidence/sentinel-mainnet/release-closure.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const failures = [];
const pending = [];
const CANONICAL_TOKEN = '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3';
const CANONICAL_POOL_ID = '0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d';
const EIP191_SIGNATURE_PATTERN = /^0x[0-9a-f]{130}$/i;
const HEX_BYTES_PATTERN = /^0x(?:[0-9a-f]{2})+$/i;
const EXACT_PLACEHOLDER_PATTERN = /^(?:0x)?(?:0+|f+|deadbeef|cafebabe|1234(?:5678)?|todo|tbd|pending|placeholder)$/i;
const PLACEHOLDER_TOKEN_PATTERN = /\b(?:TODO|TBD|PENDING|PLACEHOLDER)\b/i;

function isRepeatedHex(value) {
  if (typeof value !== 'string' || !value.startsWith('0x')) return false;
  const body = value.slice(2).toLowerCase();
  return body.length > 0 && /^(.)\1+$/.test(body);
}

function isPlaceholderLike(value) {
  if (typeof value !== 'string') return true;
  const normalized = value.trim();
  return normalized.length === 0
    || /[<>]/.test(normalized)
    || EXACT_PLACEHOLDER_PATTERN.test(normalized)
    || PLACEHOLDER_TOKEN_PATTERN.test(normalized)
    || isRepeatedHex(normalized);
}

function isValidAttestationSignature(entry) {
  const signature = entry?.signature;
  const verificationMode = String(entry?.verificationMode ?? '').toLowerCase();
  if (typeof signature !== 'string' || isPlaceholderLike(signature)) return false;
  if (verificationMode === 'eip191') return EIP191_SIGNATURE_PATTERN.test(signature);
  if (verificationMode === 'eip1271') return HEX_BYTES_PATTERN.test(signature) && signature.length >= 132;
  return false;
}

async function readJson(file, label) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    failures.push(`${label}: cannot read valid JSON from ${file}: ${error.message}`);
    return null;
  }
}

if (manifest.chainId !== 8453) failures.push('chainId must be 8453');
if (manifest.token?.toLowerCase() !== CANONICAL_TOKEN) failures.push('canonical token mismatch');
if (manifest.poolId?.toLowerCase() !== CANONICAL_POOL_ID) failures.push('canonical poolId mismatch');

for (const file of manifest.requiredEvidenceFiles ?? []) {
  try { await access(file); } catch { failures.push(`missing required evidence file: ${file}`); }
}

for (const [name, gate] of Object.entries(manifest.gates ?? {})) {
  if (gate.status === 'complete') {
    for (const file of gate.evidence ?? []) {
      try { await access(file); } catch { failures.push(`${name}: missing evidence ${file}`); }
    }
  } else {
    pending.push(`${name}: ${gate.status}`);
  }
}

if (mode === 'final') {
  const attestationGate = manifest.gates?.beneficiaryControlAttestations;
  if (attestationGate?.status === 'complete') {
    const attestations = await readJson('release-evidence/sentinel-mainnet/attestations/manifest.json', 'beneficiaryControlAttestations');
    if (attestations) {
      if (!Array.isArray(attestations.attestations) || attestations.attestations.length !== 4) {
        failures.push('beneficiaryControlAttestations: exactly four attestations are required');
      } else {
        for (const entry of attestations.attestations) {
          const beneficiary = entry.beneficiary ?? 'unknown beneficiary';
          const verificationMode = String(entry.verificationMode ?? '').toLowerCase();
          if (entry.status !== 'signed') failures.push(`${beneficiary}: attestation is not signed`);
          if (typeof entry.message !== 'string' || entry.message.length < 80) failures.push(`${beneficiary}: message is missing or too short`);
          if (!['eip191', 'eip1271'].includes(verificationMode)) failures.push(`${beneficiary}: verificationMode must be eip191 or eip1271`);
          if (!isValidAttestationSignature(entry)) {
            const expected = verificationMode === 'eip1271'
              ? 'non-placeholder variable-length EIP-1271 hex bytes'
              : 'non-placeholder 65-byte EIP-191 signature';
            failures.push(`${beneficiary}: signature must be ${expected}`);
          }
        }
      }
    }
  }

  const smokeGate = manifest.gates?.authorizedBuySellSmokeTest;
  if (smokeGate?.status === 'complete') {
    const authorization = await readJson('release-evidence/sentinel-mainnet/smoke-test/authorization.json', 'authorizedBuySellSmokeTest authorization');
    const receipts = await readJson('release-evidence/sentinel-mainnet/smoke-test/smoke-test-receipts.json', 'authorizedBuySellSmokeTest receipts');

    if (authorization) {
      if (authorization.status !== 'authorized') failures.push('authorizedBuySellSmokeTest: authorization status must be authorized');
      if (authorization.chainId !== 8453) failures.push('authorizedBuySellSmokeTest: authorization chainId mismatch');
      if (authorization.token?.toLowerCase() !== CANONICAL_TOKEN) failures.push('authorizedBuySellSmokeTest: authorization token mismatch');
      if (authorization.poolId?.toLowerCase() !== CANONICAL_POOL_ID) failures.push('authorizedBuySellSmokeTest: authorization poolId mismatch');
      if (!/^0x[0-9a-f]{64}$/i.test(authorization.buyTransactionHash ?? '')) failures.push('authorizedBuySellSmokeTest: authorization buy transaction hash is malformed');
      if (!/^0x[0-9a-f]{64}$/i.test(authorization.sellTransactionHash ?? '')) failures.push('authorizedBuySellSmokeTest: authorization sell transaction hash is malformed');
    }

    if (receipts) {
      if (receipts.chainId !== 8453) failures.push('authorizedBuySellSmokeTest: receipt chainId mismatch');
      if (receipts.poolId?.toLowerCase() !== CANONICAL_POOL_ID) failures.push('authorizedBuySellSmokeTest: receipt poolId mismatch');
      if (!receipts.buy?.directions?.includes('buy-sentinel-with-weth')) failures.push('authorizedBuySellSmokeTest: verified buy direction is missing');
      if (!receipts.sell?.directions?.includes('sell-sentinel-for-weth')) failures.push('authorizedBuySellSmokeTest: verified sell direction is missing');
      if (!/^0x[0-9a-f]{64}$/i.test(receipts.buy?.transactionHash ?? '')) failures.push('authorizedBuySellSmokeTest: buy transaction hash is malformed');
      if (!/^0x[0-9a-f]{64}$/i.test(receipts.sell?.transactionHash ?? '')) failures.push('authorizedBuySellSmokeTest: sell transaction hash is malformed');
      if (receipts.buy?.signer?.toLowerCase() !== receipts.sell?.signer?.toLowerCase()) failures.push('authorizedBuySellSmokeTest: buy and sell signers differ');
      if (authorization?.testWallet && receipts.buy?.signer?.toLowerCase() !== authorization.testWallet.toLowerCase()) failures.push('authorizedBuySellSmokeTest: receipt signer differs from authorized wallet');
      if (authorization?.buyTransactionHash?.toLowerCase() !== receipts.buy?.transactionHash?.toLowerCase()) failures.push('authorizedBuySellSmokeTest: buy hash differs from authorization');
      if (authorization?.sellTransactionHash?.toLowerCase() !== receipts.sell?.transactionHash?.toLowerCase()) failures.push('authorizedBuySellSmokeTest: sell hash differs from authorization');
    }
  }

  const signoffGate = manifest.gates?.independentSecuritySignoff;
  if (signoffGate?.status === 'complete') {
    const signoff = await readJson('release-evidence/sentinel-mainnet/independent-review/signoff.json', 'independentSecuritySignoff');
    if (signoff) {
      if (signoff.status !== 'signed') failures.push('independentSecuritySignoff: status must be signed');
      if (signoff.decision !== 'approve') failures.push('independentSecuritySignoff: decision must be approve');
      if (!/^[0-9a-f]{40}$/i.test(signoff.reviewedCommit ?? '')) failures.push('independentSecuritySignoff: reviewedCommit must be an exact commit SHA');
      if (typeof signoff.reviewerName !== 'string' || signoff.reviewerName.trim().length < 2) failures.push('independentSecuritySignoff: reviewerName is missing');
      if (typeof signoff.independenceStatement !== 'string' || signoff.independenceStatement.trim().length < 40) failures.push('independentSecuritySignoff: independenceStatement is missing or too short');
      if (!Array.isArray(signoff.evidenceReviewed) || signoff.evidenceReviewed.length < 5) failures.push('independentSecuritySignoff: evidenceReviewed is incomplete');
      if (typeof signoff.signatureReference !== 'string' || signoff.signatureReference.trim().length < 8 || isPlaceholderLike(signoff.signatureReference)) failures.push('independentSecuritySignoff: signatureReference is missing or placeholder-like');
    }
  }
}

if (failures.length) {
  console.error('Release-closure manifest is invalid:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log(`Release-closure readiness structure is valid. Complete gates: ${Object.values(manifest.gates).filter((gate) => gate.status === 'complete').length}.`);
if (pending.length) console.log('Pending gates:\n- ' + pending.join('\n- '));
if (mode === 'final' && pending.length) process.exit(1);
