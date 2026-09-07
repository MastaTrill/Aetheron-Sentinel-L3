#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getAddress, isAddress, verifyMessage } from 'ethers';

const manifestPath =
  process.env.SENTINEL_REDEPLOYMENT_MANIFEST ??
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const authorizationPath =
  process.env.SENTINEL_MAINNET_AUTHORIZATION ??
  'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json';
const releaseCommit = process.env.SENTINEL_RELEASE_COMMIT;
const exactRiskStatement =
  'I accept the risk of proceeding without an independent security review for this exact commit and manifest.';

function lower(value) {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function authorizationMessage(evidence) {
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

if (!/^[0-9a-f]{40}$/i.test(releaseCommit ?? '')) {
  throw new Error('SENTINEL_RELEASE_COMMIT must be the exact 40-character release commit');
}

const [manifestBytes, authorizationBytes] = await Promise.all([
  readFile(manifestPath),
  readFile(authorizationPath),
]);
const authorization = JSON.parse(authorizationBytes.toString('utf8'));
const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');

if (authorization.schemaVersion !== 1 || authorization.status !== 'authorized') {
  throw new Error('Mainnet authorization evidence must be schemaVersion 1 and authorized');
}
if (
  authorization.confirmation !== 'AUTHORIZE_SENTINEL_BASE_MAINNET_BROADCAST' ||
  authorization.chainId !== 8453
) {
  throw new Error('Exact Base Mainnet broadcast authorization is required');
}
if (authorization.approvedManifest?.sha256 !== manifestSha256) {
  throw new Error('Authorization manifest digest does not match the exact deployment manifest');
}
if (lower(authorization.authorization?.authorizedCommit) !== lower(releaseCommit)) {
  throw new Error('Authorization commit does not match SENTINEL_RELEASE_COMMIT');
}
if (!isAddress(authorization.authorization?.authorizedSender)) {
  throw new Error('Authorization sender is malformed');
}
if (authorization.authorization?.method !== 'cryptographic-signature') {
  throw new Error('Authorization method must be cryptographic-signature');
}
if (!/^https:\/\//i.test(authorization.authorization?.reference ?? '')) {
  throw new Error('Authorization requires a public HTTPS reference');
}
if (!/^0x[0-9a-f]{130}$/i.test(authorization.authorization?.signature ?? '')) {
  throw new Error('Authorization signature must be a 65-byte EVM signature');
}
if (
  authorization.riskAcceptance?.proceedWithoutIndependentSecurityReview !== true ||
  authorization.riskAcceptance?.acceptedBy !== authorization.authorization?.authorizedSender ||
  authorization.riskAcceptance?.statement !== exactRiskStatement
) {
  throw new Error('Exact owner risk acceptance is required');
}
const expiresAtMs = Date.parse(authorization.limitations?.expiresAt ?? '');
if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
  throw new Error('Base Mainnet authorization is expired or malformed');
}
if (!/^(0|[1-9]\d*)$/.test(String(authorization.limitations?.maxGasCostWei ?? ''))) {
  throw new Error('Authorization maxGasCostWei must be a canonical decimal string');
}
if (BigInt(authorization.limitations.maxGasCostWei) <= 0n) {
  throw new Error('Authorization maxGasCostWei must be positive');
}

const recovered = getAddress(
  verifyMessage(authorizationMessage(authorization), authorization.authorization.signature)
);
const authorizedSender = getAddress(authorization.authorization.authorizedSender);
if (recovered !== authorizedSender) {
  throw new Error(`Authorization signature recovers ${recovered}, expected ${authorizedSender}`);
}

console.log('SENTINEL Base Mainnet authorization: PASS');
console.log(`authorizedCommit=${authorization.authorization.authorizedCommit}`);
console.log(`authorizedSender=${authorizedSender}`);
console.log(`expiresAt=${authorization.limitations.expiresAt}`);
console.log(`manifestSha256=${manifestSha256}`);
