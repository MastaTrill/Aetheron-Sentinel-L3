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
const ETH_SIGNATURE_PATTERN = /^0x[0-9a-f]{130}$/i;
const PLACEHOLDER_PATTERN = /^(?:0x)?(?:0+|f+|deadbeef|cafebabe|1234(?:5678)?|todo|tbd|placeholder)$/i;

function isValidSignature(value) {
  if (typeof value !== 'string' || !ETH_SIGNATURE_PATTERN.test(value)) return false;
  const body = value.slice(2).toLowerCase();
  if (/^(.)\1+$/.test(body)) return false;
  return !PLACEHOLDER_PATTERN.test(value);
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
          if (entry.status !== 'signed') failures.push(`${entry.beneficiary ?? 'unknown beneficiary'}: attestation is not signed`);
          if (typeof entry.message !== 'string' || entry.message.length < 80) failures.push(`${entry.beneficiary ?? 'unknown beneficiary'}: message is missing or too short`);
          if (!isValidSignature(entry.signature)) failures.push(`${entry.beneficiary ?? 'unknown beneficiary'}: signature must be a non-placeholder 65-byte Ethereum signature`);
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
      if (typeof signoff.signatureReference !== 'string' || signoff.signatureReference.trim().length < 8 || PLACEHOLDER_PATTERN.test(signoff.signatureReference.trim())) failures.push('independentSecuritySignoff: signatureReference is missing or placeholder-like');
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
