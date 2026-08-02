#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

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
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;
const SIGNATURE_PATTERN = /^0x[0-9a-f]{130}$/i;
const PLACEHOLDER_PATTERN = /(REPLACE_WITH|PENDING_|template-not-evidence)/i;
const EXPECTED_DEPLOYMENT_MANIFEST_SHA256 =
  'f727b14201ec419518a683f329b0797b98764daec7f7cdbc6ccd3d0d83423e1d';
const DEPLOYMENT_MANIFEST_EVIDENCE =
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const BASE_SEPOLIA_EVIDENCE =
  'release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal.json';
const RPC_EVIDENCE = [
  'release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-a.json',
  'release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-b.json',
];
const AUTHORITY_EVIDENCE =
  'release-evidence/sentinel-mainnet/redeployment/authority-beneficiary-verification.json';
const SECURITY_SIGNOFF_EVIDENCE =
  'release-evidence/sentinel-mainnet/redeployment/independent-security-signoff.json';
const MAINNET_AUTHORIZATION_EVIDENCE =
  'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json';
const MAINNET_DEPLOYMENT_EVIDENCE =
  'release-evidence/sentinel-mainnet/redeployment/deployment-receipt.json';
const SMOKE_AUTHORIZATION_EVIDENCE =
  'release-evidence/sentinel-mainnet/redeployment/smoke-test-authorization.json';
const SMOKE_RECEIPTS_EVIDENCE =
  'release-evidence/sentinel-mainnet/redeployment/smoke-test-receipts.json';
const IMMUTABLE_SUMS_EVIDENCE =
  'release-evidence/sentinel-mainnet/redeployment/SHA256SUMS';
const EVIDENCE_ROOT = process.env.SENTINEL_REDEPLOYMENT_EVIDENCE_ROOT ?? '.';
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

function resolveEvidencePath(file) {
  return path.resolve(EVIDENCE_ROOT, file);
}

function containsPlaceholder(value) {
  if (typeof value === 'string') return PLACEHOLDER_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (value && typeof value === 'object') {
    return Object.values(value).some(containsPlaceholder);
  }
  return false;
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireSha256(label, value) {
  if (!SHA256_PATTERN.test(value ?? '') || /^0{64}$/i.test(value)) {
    failures.push(`${label} must be a nonzero SHA-256 digest`);
  }
}

function mainnetAuthorizationMessage(evidence) {
  return [
    'AETHERON SENTINEL BASE MAINNET AUTHORIZATION',
    `chainId:${evidence.chainId}`,
    `manifestSha256:${lower(evidence.approvedManifest?.sha256)}`,
    `authorizedCommit:${lower(evidence.authorization?.authorizedCommit)}`,
    `authorizedSender:${lower(evidence.authorization?.authorizedSender)}`,
    `maxGasCostWei:${evidence.limitations?.maxGasCostWei}`,
    `expiresAt:${evidence.limitations?.expiresAt}`,
  ].join('\n');
}

function requireVerifiedTreasuryShare(label, beneficiaries) {
  const treasury = Array.isArray(beneficiaries)
    ? beneficiaries.find(entry => entry?.role === 'aetheron-treasury')
    : undefined;
  if (!treasury) {
    failures.push(`${label} must include the aetheron-treasury beneficiary`);
    return;
  }
  if (lower(treasury.beneficiary) !== REQUIRED_TREASURY) {
    failures.push(`${label} treasury beneficiary must be the established Aetheron treasury`);
  }
  if (String(treasury.shares ?? '') !== EXPECTED_CREATOR_SHARE_WAD) {
    failures.push(`${label} treasury share must be exactly 57%`);
  }
  if (
    Object.hasOwn(treasury, 'verifiedShares') &&
    String(treasury.verifiedShares ?? '') !== EXPECTED_CREATOR_SHARE_WAD
  ) {
    failures.push(`${label} verified treasury share must be exactly 57%`);
  }
}

async function validateCompletedGateEvidence(name, evidenceByPath) {
  if (name === 'exactDeploymentManifest') {
    const evidence = evidenceByPath.get(DEPLOYMENT_MANIFEST_EVIDENCE)?.data;
    if (!evidence) return;
    const raw = evidenceByPath.get(DEPLOYMENT_MANIFEST_EVIDENCE)?.raw;
    if (raw && sha256(raw) !== EXPECTED_DEPLOYMENT_MANIFEST_SHA256) {
      failures.push('exactDeploymentManifest: evidence file digest mismatch');
    }
    if (evidence.schemaVersion !== 1) {
      failures.push('exactDeploymentManifest: evidence schemaVersion must be 1');
    }
    if (evidence.releaseModel !== 'controlled-redeployment') {
      failures.push('exactDeploymentManifest: releaseModel must be controlled-redeployment');
    }
    if (evidence.status !== 'preparation-only') {
      failures.push('exactDeploymentManifest: evidence must remain preparation-only');
    }
    if (
      evidence.safety?.signingEnabled !== false ||
      evidence.safety?.broadcastEnabled !== false ||
      evidence.safety?.baseMainnetAuthorized !== false ||
      evidence.safety?.requiresIndependentHumanReview !== true ||
      evidence.safety?.requiresSeparateExplicitMainnetAuthorization !== true
    ) {
      failures.push('exactDeploymentManifest: fail-closed safety assertions are invalid');
    }
    requireVerifiedTreasuryShare(
      'exactDeploymentManifest',
      evidence.pool?.beneficiaries
    );
  }

  if (name === 'baseSepoliaRehearsal') {
    const evidence = evidenceByPath.get(BASE_SEPOLIA_EVIDENCE)?.data;
    if (!evidence) return;
    if (evidence.schemaVersion !== 1) {
      failures.push('baseSepoliaRehearsal: evidence schemaVersion must be 1');
    }
    if (evidence.mode !== 'protected-testnet-broadcast' || evidence.chainId !== 84532) {
      failures.push('baseSepoliaRehearsal: evidence must be a Base Sepolia protected broadcast');
    }
    if (evidence.manifest?.sha256 !== EXPECTED_DEPLOYMENT_MANIFEST_SHA256) {
      failures.push('baseSepoliaRehearsal: deployment manifest digest mismatch');
    }
    if (!COMMIT_PATTERN.test(evidence.request?.sourceCommit ?? '')) {
      failures.push('baseSepoliaRehearsal: sourceCommit must be a 40-character commit');
    }
    if (evidence.status !== 'confirmed' || evidence.receipt?.status !== 1) {
      failures.push('baseSepoliaRehearsal: transaction receipt must be confirmed and successful');
    }
    if (
      evidence.safety?.baseMainnetAuthorized !== false ||
      evidence.safety?.mainnetTransactionProduced !== false ||
      evidence.safety?.privateKeyRecorded !== false
    ) {
      failures.push('baseSepoliaRehearsal: fail-closed safety assertions are invalid');
    }
    requireAddress('baseSepoliaRehearsal signer', evidence.signer);
    requireAddress('baseSepoliaRehearsal token', evidence.tokenState?.address);
    requireHash('baseSepoliaRehearsal transactionHash', evidence.transactionHash);
    requireHash('baseSepoliaRehearsal poolId', evidence.predicted?.poolId);
    requireVerifiedTreasuryShare(
      'baseSepoliaRehearsal',
      evidence.beneficiaryShares
    );
  }

  if (name === 'independentRpcReproduction') {
    const rpcEvidence = RPC_EVIDENCE.map(file => evidenceByPath.get(file)?.data).filter(Boolean);
    for (const [index, evidence] of rpcEvidence.entries()) {
      const label = `independentRpcReproduction provider ${index + 1}`;
      if (evidence.schemaVersion !== 1 || evidence.status !== 'verified') {
        failures.push(`${label}: evidence status must be verified`);
      }
      if (evidence.chainId !== 8453) {
        failures.push(`${label}: chainId must be 8453`);
      }
      if (!isIsoTimestamp(evidence.capturedAtUtc)) {
        failures.push(`${label}: capturedAtUtc must be an ISO timestamp`);
      }
      if (!Number.isInteger(evidence.blockNumber) || evidence.blockNumber <= 0) {
        failures.push(`${label}: blockNumber must be positive`);
      }
      requireHash(`${label} blockHash`, evidence.blockHash);
      requireAddress(`${label} token`, evidence.token?.address);
      requireAddress(`${label} token owner`, evidence.token?.owner);
      requireHash(`${label} runtimeCodeHash`, evidence.token?.runtimeCodeHash);
      requireHash(`${label} poolId`, evidence.pool?.poolId);
      requireVerifiedTreasuryShare(label, evidence.pool?.beneficiaries);
    }
    if (
      rpcEvidence.length === 2 &&
      (rpcEvidence[0].provider === rpcEvidence[1].provider ||
        rpcEvidence[0].endpoint === rpcEvidence[1].endpoint)
    ) {
      failures.push('independentRpcReproduction: providers and endpoints must be independent');
    }
  }

  if (name === 'authorityAndBeneficiaryVerification') {
    const evidence = evidenceByPath.get(AUTHORITY_EVIDENCE)?.data;
    if (!evidence) return;
    if (evidence.schemaVersion !== 1 || evidence.status !== 'verified') {
      failures.push('authorityAndBeneficiaryVerification: evidence status must be verified');
    }
    if (!isIsoTimestamp(evidence.verifiedAtUtc) || evidence.network?.chainId !== 8453) {
      failures.push('authorityAndBeneficiaryVerification: timestamp and Base Mainnet chain are required');
    }
    const owner = evidence.verifications?.tokenOwner;
    requireAddress('authorityAndBeneficiaryVerification token', owner?.address);
    requireAddress('authorityAndBeneficiaryVerification expectedOwner', owner?.expectedOwner);
    if (lower(owner?.actualOwner) !== lower(owner?.expectedOwner) || owner?.reachabilityTestPassed !== true) {
      failures.push('authorityAndBeneficiaryVerification: token owner must match and be reachable');
    }
    const beneficiary = evidence.verifications?.poolCreatorBeneficiary;
    requireHash('authorityAndBeneficiaryVerification poolId', beneficiary?.poolId);
    if (
      lower(beneficiary?.expectedBeneficiary) !== REQUIRED_TREASURY ||
      lower(beneficiary?.actualBeneficiary) !== REQUIRED_TREASURY ||
      String(beneficiary?.shareWad ?? '') !== EXPECTED_CREATOR_SHARE_WAD ||
      beneficiary?.reachabilityTestPassed !== true
    ) {
      failures.push('authorityAndBeneficiaryVerification: treasury beneficiary verification is invalid');
    }
    const timelock = evidence.verifications?.timelockConsequences;
    if (
      lower(timelock?.actualAdmin) !== lower(timelock?.expectedAdmin) ||
      timelock?.consequencesApproved !== true
    ) {
      failures.push('authorityAndBeneficiaryVerification: timelock administration is unverified');
    }
  }

  if (name === 'independentSecuritySignoff') {
    const evidence = evidenceByPath.get(SECURITY_SIGNOFF_EVIDENCE)?.data;
    if (!evidence) return;
    if (evidence.schemaVersion !== 1 || evidence.status !== 'approved') {
      failures.push('independentSecuritySignoff: evidence status must be approved');
    }
    if (
      !evidence.reviewer?.nameOrOrganization ||
      !evidence.reviewer?.professionalIdentity ||
      !evidence.reviewer?.contact ||
      String(evidence.reviewer?.independenceStatement ?? '').length < 40
    ) {
      failures.push('independentSecuritySignoff: verifiable reviewer identity and independence statement are required');
    }
    if (!isIsoTimestamp(evidence.review?.reviewedAtUtc)) {
      failures.push('independentSecuritySignoff: reviewedAtUtc must be an ISO timestamp');
    }
    if (!COMMIT_PATTERN.test(evidence.review?.commit ?? '')) {
      failures.push('independentSecuritySignoff: reviewed commit must be a 40-character commit');
    }
    if (evidence.review?.deploymentManifestSha256 !== EXPECTED_DEPLOYMENT_MANIFEST_SHA256) {
      failures.push('independentSecuritySignoff: deployment manifest digest mismatch');
    }
    requireSha256(
      'independentSecuritySignoff baseSepoliaRehearsalSha256',
      evidence.review?.baseSepoliaRehearsalSha256
    );
    try {
      const rehearsalRaw = await readFile(resolveEvidencePath(BASE_SEPOLIA_EVIDENCE));
      const rehearsalEvidence = JSON.parse(rehearsalRaw);
      const actualDigest = sha256(rehearsalRaw);
      if (lower(evidence.review?.baseSepoliaRehearsalSha256) !== actualDigest) {
        failures.push(
          'independentSecuritySignoff: baseSepoliaRehearsalSha256 must equal the reviewed evidence digest'
        );
      }
      if (
        lower(evidence.review?.rehearsalSourceCommit) !==
        lower(rehearsalEvidence.request?.sourceCommit)
      ) {
        failures.push(
          'independentSecuritySignoff: rehearsalSourceCommit must equal the rehearsal sourceCommit'
        );
      }
    } catch {
      failures.push('independentSecuritySignoff: Base Sepolia evidence is unavailable for digest verification');
    }
    if (
      evidence.review?.conclusion !== 'approve' ||
      !Array.isArray(evidence.review?.reproductionMethods) ||
      evidence.review.reproductionMethods.length === 0 ||
      evidence.requiredAssertions?.materialClaimsReproduced !== true
    ) {
      failures.push('independentSecuritySignoff: reproduced approval conclusion is required');
    }
    const approvalReference = evidence.review?.approvalReference ?? '';
    if (!SIGNATURE_PATTERN.test(approvalReference) && !/^https:\/\//i.test(approvalReference)) {
      failures.push('independentSecuritySignoff: approvalReference must be a 65-byte signature or public HTTPS review');
    }
    if (
      lower(evidence.requiredAssertions?.creatorBeneficiary) !== REQUIRED_TREASURY ||
      String(evidence.requiredAssertions?.creatorShareWad ?? '') !== EXPECTED_CREATOR_SHARE_WAD ||
      lower(evidence.requiredAssertions?.legacyTokenExcluded) !== LEGACY_TOKEN
    ) {
      failures.push('independentSecuritySignoff: required beneficiary assertions are invalid');
    }
  }

  if (name === 'explicitMainnetAuthorization') {
    const evidence = evidenceByPath.get(MAINNET_AUTHORIZATION_EVIDENCE)?.data;
    if (!evidence) return;
    if (evidence.schemaVersion !== 1 || evidence.status !== 'authorized') {
      failures.push('explicitMainnetAuthorization: evidence status must be authorized');
    }
    if (
      evidence.confirmation !== 'AUTHORIZE_SENTINEL_BASE_MAINNET_BROADCAST' ||
      evidence.chainId !== 8453
    ) {
      failures.push('explicitMainnetAuthorization: exact Base Mainnet confirmation is required');
    }
    if (evidence.approvedManifest?.sha256 !== EXPECTED_DEPLOYMENT_MANIFEST_SHA256) {
      failures.push('explicitMainnetAuthorization: deployment manifest digest mismatch');
    }
    if (
      !isIsoTimestamp(evidence.limitations?.expiresAt) ||
      Date.parse(evidence.limitations.expiresAt) <= Date.now()
    ) {
      failures.push('explicitMainnetAuthorization: authorization must be unexpired');
    }
    requireAddress(
      'explicitMainnetAuthorization authorizedSender',
      evidence.authorization?.authorizedSender
    );
    if (!isIsoTimestamp(evidence.authorization?.authorizedAtUtc)) {
      failures.push('explicitMainnetAuthorization: authorizedAtUtc must be an ISO timestamp');
    }
    if (!COMMIT_PATTERN.test(evidence.authorization?.authorizedCommit ?? '')) {
      failures.push('explicitMainnetAuthorization: authorizedCommit must be a 40-character commit');
    }
    if (!/^https:\/\//i.test(evidence.authorization?.reference ?? '')) {
      failures.push('explicitMainnetAuthorization: a verifiable public HTTPS authorization reference is required');
    }
    if (evidence.authorization?.method !== 'cryptographic-signature') {
      failures.push('explicitMainnetAuthorization: method must be cryptographic-signature');
    }
    const signature = evidence.authorization?.signature ?? '';
    if (!SIGNATURE_PATTERN.test(signature)) {
      failures.push('explicitMainnetAuthorization: cryptographic signature must be 65 bytes');
    } else {
      try {
        const { verifyMessage } = await import('ethers');
        const recovered = verifyMessage(mainnetAuthorizationMessage(evidence), signature);
        if (lower(recovered) !== lower(evidence.authorization?.authorizedSender)) {
          failures.push(
            'explicitMainnetAuthorization: signature does not recover authorizedSender'
          );
        }
      } catch {
        failures.push('explicitMainnetAuthorization: signature could not be cryptographically verified');
      }
    }
    try {
      const signoff = JSON.parse(
        await readFile(resolveEvidencePath(SECURITY_SIGNOFF_EVIDENCE), 'utf8')
      );
      if (
        lower(evidence.authorization?.authorizedCommit) !==
        lower(signoff.review?.commit)
      ) {
        failures.push(
          'explicitMainnetAuthorization: authorizedCommit must equal the independently reviewed commit'
        );
      }
    } catch {
      failures.push('explicitMainnetAuthorization: independent signoff is unavailable for commit binding');
    }
  }

  if (name === 'baseMainnetDeployment') {
    const evidence = evidenceByPath.get(MAINNET_DEPLOYMENT_EVIDENCE)?.data;
    if (!evidence) return;
    if (
      evidence.schemaVersion !== 1 ||
      evidence.status !== 'confirmed' ||
      evidence.chainId !== 8453
    ) {
      failures.push('baseMainnetDeployment: confirmed Base Mainnet evidence is required');
    }
    if (evidence.manifestSha256 !== EXPECTED_DEPLOYMENT_MANIFEST_SHA256) {
      failures.push('baseMainnetDeployment: deployment manifest digest mismatch');
    }
    if (!COMMIT_PATTERN.test(evidence.releaseCommit ?? '')) {
      failures.push('baseMainnetDeployment: releaseCommit must be a 40-character commit');
    }
    requireHash('baseMainnetDeployment transactionHash', evidence.transactionHash);
    requireHash('baseMainnetDeployment blockHash', evidence.receipt?.blockHash);
    if (
      evidence.receipt?.status !== 1 ||
      !Number.isInteger(evidence.receipt?.blockNumber) ||
      evidence.receipt.blockNumber <= 0
    ) {
      failures.push('baseMainnetDeployment: successful receipt and positive blockNumber are required');
    }
    requireAddress('baseMainnetDeployment token', evidence.replacement?.token);
    requireAddress('baseMainnetDeployment initializer', evidence.replacement?.initializer);
    requireHash('baseMainnetDeployment poolId', evidence.replacement?.poolId);
    if (
      lower(evidence.replacement?.token) !== lower(replacement.token) ||
      lower(evidence.replacement?.initializer) !== lower(replacement.initializer) ||
      lower(evidence.replacement?.poolId) !== lower(replacement.poolId) ||
      lower(evidence.transactionHash) !== lower(replacement.deploymentTransactionHash)
    ) {
      failures.push('baseMainnetDeployment: receipt must match replacementDeployment');
    }
  }

  if (name === 'authorizedBuySellSmokeTest') {
    const authorization = evidenceByPath.get(SMOKE_AUTHORIZATION_EVIDENCE)?.data;
    const receipts = evidenceByPath.get(SMOKE_RECEIPTS_EVIDENCE)?.data;
    if (!authorization || !receipts) return;
    if (
      authorization.schemaVersion !== 1 ||
      authorization.status !== 'authorized' ||
      authorization.chainId !== 8453 ||
      authorization.confirmation !== 'AUTHORIZE_SENTINEL_BASE_MAINNET_SMOKE_TEST'
    ) {
      failures.push('authorizedBuySellSmokeTest: exact smoke-test authorization is required');
    }
    if (
      !isIsoTimestamp(authorization.expiresAt) ||
      Date.parse(authorization.expiresAt) <= Date.now()
    ) {
      failures.push('authorizedBuySellSmokeTest: authorization must be unexpired');
    }
    requireAddress(
      'authorizedBuySellSmokeTest authorizedSender',
      authorization.authorizedSender
    );
    if (
      receipts.schemaVersion !== 1 ||
      receipts.status !== 'confirmed' ||
      receipts.chainId !== 8453
    ) {
      failures.push('authorizedBuySellSmokeTest: confirmed Base Mainnet receipts are required');
    }
    requireAddress('authorizedBuySellSmokeTest token', receipts.token);
    requireHash('authorizedBuySellSmokeTest poolId', receipts.poolId);
    for (const side of ['buy', 'sell']) {
      requireHash(`authorizedBuySellSmokeTest ${side} transactionHash`, receipts[side]?.transactionHash);
      if (receipts[side]?.receiptStatus !== 1) {
        failures.push(`authorizedBuySellSmokeTest: ${side} receipt must be successful`);
      }
    }
    if (
      lower(receipts.token) !== lower(replacement.token) ||
      lower(receipts.poolId) !== lower(replacement.poolId)
    ) {
      failures.push('authorizedBuySellSmokeTest: receipts must match replacementDeployment');
    }
  }

  if (name === 'immutableEvidencePackage') {
    const raw = evidenceByPath.get(IMMUTABLE_SUMS_EVIDENCE)?.raw;
    if (!raw) return;
    const sums = new Map();
    for (const line of raw.split(/\r?\n/).filter(Boolean)) {
      const match = line.match(/^([0-9a-f]{64})  (.+)$/i);
      if (!match) {
        failures.push(`immutableEvidencePackage: invalid SHA256SUMS line: ${line}`);
        continue;
      }
      sums.set(match[2], lower(match[1]));
    }
    const requiredFiles = new Set(
      Object.values(manifest.gates ?? {})
        .flatMap(gate => (gate.status === 'complete' ? gate.evidence : []))
        .filter(file => file !== IMMUTABLE_SUMS_EVIDENCE)
    );
    for (const file of requiredFiles) {
      if (!sums.has(file)) {
        failures.push(`immutableEvidencePackage: missing checksum for ${file}`);
        continue;
      }
      try {
        const actual = sha256(await readFile(resolveEvidencePath(file)));
        if (sums.get(file) !== actual) {
          failures.push(`immutableEvidencePackage: checksum mismatch for ${file}`);
        }
      } catch {
        failures.push(`immutableEvidencePackage: cannot checksum ${file}`);
      }
    }
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
    const evidenceByPath = new Map();
    for (const file of gate.evidence) {
      try {
        const resolved = resolveEvidencePath(file);
        await access(resolved);
        const raw = await readFile(resolved, 'utf8');
        if (file.endsWith('.json')) {
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            failures.push(`${name}: evidence is not valid JSON: ${file}`);
            continue;
          }
          evidenceByPath.set(file, { data, raw });
          if (containsPlaceholder(data)) {
            failures.push(`${name}: evidence contains placeholder or template values: ${file}`);
          }
        } else {
          evidenceByPath.set(file, { raw });
        }
      } catch {
        failures.push(`${name}: missing evidence ${file}`);
      }
    }
    await validateCompletedGateEvidence(name, evidenceByPath);
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

if (
  manifest.gates?.explicitMainnetAuthorization?.status === 'complete' &&
  manifest.gates?.independentSecuritySignoff?.status !== 'complete'
) {
  failures.push('explicitMainnetAuthorization requires completed independentSecuritySignoff');
}
if (
  manifest.gates?.baseMainnetDeployment?.status === 'complete' &&
  manifest.gates?.explicitMainnetAuthorization?.status !== 'complete'
) {
  failures.push('baseMainnetDeployment requires completed explicitMainnetAuthorization');
}
if (
  manifest.gates?.authorizedBuySellSmokeTest?.status === 'complete' &&
  manifest.gates?.baseMainnetDeployment?.status !== 'complete'
) {
  failures.push('authorizedBuySellSmokeTest requires completed baseMainnetDeployment');
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
