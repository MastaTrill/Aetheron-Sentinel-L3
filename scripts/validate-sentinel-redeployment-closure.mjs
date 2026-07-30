#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';

const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
const mode = modeArg?.split('=')[1] ?? 'readiness';
if (!['readiness', 'final'].includes(mode)) {
  throw new Error('Use --mode=readiness or --mode=final');
}

const manifestPath =
  process.env.SENTINEL_REDEPLOYMENT_CLOSURE_MANIFEST ??
  'release-evidence/sentinel-mainnet/redeployment-closure.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const failures = [];
const pending = [];

const LEGACY_TOKEN = '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3';
const LEGACY_POOL_ID = '0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d';
const LEGACY_BENEFICIARY = '0x7e3d11f70084d667295710e6b7ff50c3b0487a45';
const REQUIRED_TREASURY = '0xa4737aa4b1e8a3c8f221be9e55f5bda307ecc1fa';
const EXPECTED_CREATOR_SHARE_WAD = '570000000000000000';
const EXPECTED_DECISION =
  'docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md';
const REQUIRED_EVIDENCE_FILES = [EXPECTED_DECISION, 'sentinel-l3-v1.0/README_DEPRECATED.md'];
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/i;
const HASH_PATTERN = /^0x[0-9a-f]{64}$/i;
const ZERO_HASH_PATTERN = /^0x0{64}$/i;
const REQUIRED_GATES = [
  'exactDeploymentManifest',
  'baseSepoliaRehearsal',
  'independentRpcReproduction',
  'authorityAndBeneficiaryVerification',
  'independentSecuritySignoff',
  'explicitMainnetAuthorization',
  'baseMainnetDeployment',
  'authorizedBuySellSmokeTest',
  'immutableEvidencePackage',
];
const GATE_EVIDENCE_REQUIREMENTS = {
  exactDeploymentManifest: [
    'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json',
  ],
  baseSepoliaRehearsal: [
    'release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal.json',
  ],
  independentRpcReproduction: [
    'release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-a.json',
    'release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-b.json',
  ],
  authorityAndBeneficiaryVerification: [
    'release-evidence/sentinel-mainnet/redeployment/authority-beneficiary-verification.json',
  ],
  independentSecuritySignoff: [
    'release-evidence/sentinel-mainnet/redeployment/independent-security-signoff.json',
  ],
  explicitMainnetAuthorization: [
    'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json',
  ],
  baseMainnetDeployment: [
    'release-evidence/sentinel-mainnet/redeployment/deployment-receipt.json',
  ],
  authorizedBuySellSmokeTest: [
    'release-evidence/sentinel-mainnet/redeployment/smoke-test-authorization.json',
    'release-evidence/sentinel-mainnet/redeployment/smoke-test-receipts.json',
  ],
  immutableEvidencePackage: [
    'release-evidence/sentinel-mainnet/redeployment/SHA256SUMS',
  ],
};

function lower(value) {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

function requireAddress(label, value) {
  if (!ADDRESS_PATTERN.test(value ?? '') || /^0x0{40}$/i.test(value)) {
    failures.push(`${label} must be a nonzero EVM address`);
  }
}

function requireHash(label, value) {
  if (!HASH_PATTERN.test(value ?? '') || ZERO_HASH_PATTERN.test(value)) {
    failures.push(`${label} must be a nonzero 32-byte hash`);
  }
}

if (manifest.schemaVersion !== 2) failures.push('schemaVersion must be 2');
if (manifest.releaseModel !== 'controlled-redeployment') {
  failures.push('releaseModel must be controlled-redeployment');
}
if (manifest.chainId !== 8453) failures.push('chainId must be 8453');
if (manifest.decision !== EXPECTED_DECISION) {
  failures.push(`decision must remain ${EXPECTED_DECISION}`);
}

const legacy = manifest.legacyDeployment ?? {};
if (legacy.status !== 'legacy-non-canonical') {
  failures.push('legacy deployment must remain legacy-non-canonical');
}
if (lower(legacy.token) !== LEGACY_TOKEN) failures.push('legacy token evidence changed');
if (lower(legacy.poolId) !== LEGACY_POOL_ID) failures.push('legacy pool evidence changed');
if (lower(legacy.currentCreatorBeneficiary) !== LEGACY_BENEFICIARY) {
  failures.push('legacy beneficiary evidence changed');
}

const replacement = manifest.replacementDeployment ?? {};
if (!['preparation-only', 'deployed'].includes(replacement.status)) {
  failures.push('replacement status must be preparation-only or deployed');
}
if (lower(replacement.creatorBeneficiary) !== REQUIRED_TREASURY) {
  failures.push('replacement creator beneficiary must be the established Aetheron treasury');
}
if (String(replacement.creatorShareWad ?? '') !== EXPECTED_CREATOR_SHARE_WAD) {
  failures.push('replacement creator share must be exactly 57%');
}

if (replacement.status === 'preparation-only') {
  for (const field of ['token', 'poolId', 'initializer', 'deploymentTransactionHash']) {
    if (replacement[field] !== null) {
      failures.push(`replacement ${field} must remain null before deployment`);
    }
  }
} else {
  requireAddress('replacement token', replacement.token);
  requireAddress('replacement initializer', replacement.initializer);
  requireHash('replacement poolId', replacement.poolId);
  requireHash('replacement deploymentTransactionHash', replacement.deploymentTransactionHash);
  if (lower(replacement.token) === LEGACY_TOKEN) {
    failures.push('replacement token must differ from the legacy token');
  }
  if (lower(replacement.poolId) === LEGACY_POOL_ID) {
    failures.push('replacement poolId must differ from the legacy pool');
  }
}

const requiredEvidenceFiles = manifest.requiredEvidenceFiles;
if (!Array.isArray(requiredEvidenceFiles)) {
  failures.push('requiredEvidenceFiles must be an array');
} else {
  for (const requiredFile of REQUIRED_EVIDENCE_FILES) {
    if (!requiredEvidenceFiles.includes(requiredFile)) {
      failures.push(`requiredEvidenceFiles must include ${requiredFile}`);
    }
  }
  for (const file of requiredEvidenceFiles) {
    try {
      await access(file);
    } catch {
      failures.push(`missing required evidence file: ${file}`);
    }
  }
}

for (const name of REQUIRED_GATES) {
  const gate = manifest.gates?.[name];
  if (!gate) {
    failures.push(`missing required gate: ${name}`);
    continue;
  }
  if (!['pending', 'blocked', 'complete'].includes(gate.status)) {
    failures.push(`${name}: invalid status ${gate.status ?? 'missing'}`);
    continue;
  }
  if (!Array.isArray(gate.evidence)) {
    failures.push(`${name}: evidence must be an array`);
    continue;
  }
  if (gate.status === 'complete') {
    if (gate.evidence.length === 0) {
      failures.push(`${name}: complete gate must identify evidence`);
      continue;
    }
    for (const requiredFile of GATE_EVIDENCE_REQUIREMENTS[name]) {
      if (!gate.evidence.includes(requiredFile)) {
        failures.push(`${name}: evidence must include ${requiredFile}`);
      }
    }
    for (const file of gate.evidence) {
      try {
        await access(file);
      } catch {
        failures.push(`${name}: missing evidence ${file}`);
      }
    }
  } else {
    pending.push(`${name}: ${gate.status}`);
  }
}

if (
  replacement.status === 'preparation-only' &&
  manifest.gates?.baseMainnetDeployment?.status === 'complete'
) {
  failures.push('baseMainnetDeployment cannot be complete while replacement status is preparation-only');
}

if (mode === 'final') {
  if (replacement.status !== 'deployed') {
    failures.push('final mode requires a deployed replacement');
  }
  if (pending.length > 0) {
    failures.push(`final mode requires every gate complete; pending: ${pending.join(', ')}`);
  }
}

if (failures.length > 0) {
  console.error(`SENTINEL redeployment closure is invalid:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

const completeCount = REQUIRED_GATES.filter(
  name => manifest.gates[name].status === 'complete'
).length;
console.log(
  `SENTINEL redeployment readiness structure is valid. Complete gates: ${completeCount}/${REQUIRED_GATES.length}.`
);
if (pending.length > 0) console.log(`Pending gates:\n- ${pending.join('\n- ')}`);
