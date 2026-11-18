#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { getAddress, isAddress, verifyMessage } from 'ethers';

const EXACT_RISK_STATEMENT =
  'I accept the risk of proceeding without an independent security review for this exact commit and manifest.';

function getArg(flag, fallback = null) {
  const prefix = `${flag}=`;
  const inline = process.argv.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function resolveDefaultCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '0000000000000000000000000000000000000000';
  }
}

export function buildMainnetAuthorizationMessage(evidence) {
  const lower = (v) => String(v ?? '').toLowerCase();
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

const manifestPath =
  process.env.SENTINEL_REDEPLOYMENT_MANIFEST ??
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const outputPath =
  process.env.SENTINEL_MAINNET_AUTHORIZATION ??
  'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json';

const manifestBytes = await readFile(manifestPath);
const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');

const rawSender = getArg('--sender', '0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2');
if (!isAddress(rawSender)) {
  throw new Error(`Invalid --sender address: ${rawSender}`);
}
const authorizedSender = getAddress(rawSender);
const authorizedCommit = getArg('--commit', resolveDefaultCommit());
if (!/^[0-9a-f]{40}$/i.test(authorizedCommit)) {
  throw new Error(`--commit must be a 40-character git commit SHA (got ${authorizedCommit})`);
}

const expiresHours = Number(getArg('--expires-hours', '168'));
const now = new Date();
const authorizedAtUtc = getArg('--authorized-at', now.toISOString());
const expiresAt = getArg(
  '--expires-at',
  new Date(now.getTime() + expiresHours * 3600 * 1000).toISOString(),
);
const maxGasCostWei = getArg('--max-gas-wei', '10000000000000000');
const reference = getArg(
  '--reference',
  'https://github.com/MastaTrill/Aetheron-Sentinel-L3/releases/tag/v0.2.3',
);
const signature = getArg('--signature', null);
const shouldWrite = process.argv.includes('--write');

const draftEvidence = {
  schemaVersion: 1,
  status: 'authorized',
  confirmation: 'AUTHORIZE_SENTINEL_BASE_MAINNET_BROADCAST',
  chainId: 8453,
  limitations: {
    maxGasCostWei,
    expiresAt,
  },
  approvedManifest: {
    sha256: manifestSha256,
  },
  authorization: {
    authorizedSender,
    authorizedAtUtc,
    authorizedCommit,
    reference,
    signature: signature || '0x_SIGN_THE_EXACT_MESSAGE_BELOW_WITH_AUTHORIZED_SENDER_WALLET',
    method: 'cryptographic-signature',
  },
  notice: 'Base Mainnet broadcast authorization validated with active cryptographic wallet signature.',
  riskAcceptance: {
    proceedWithoutIndependentSecurityReview: true,
    acceptedBy: authorizedSender,
    acceptedAtUtc: authorizedAtUtc,
    statement: EXACT_RISK_STATEMENT,
  },
};

const messageToSign = buildMainnetAuthorizationMessage(draftEvidence);

if (signature) {
  if (!/^0x[0-9a-f]{130}$/i.test(signature)) {
    throw new Error('Provided --signature must be a 65-byte hex string (0x + 130 hex chars)');
  }
  const recovered = getAddress(verifyMessage(messageToSign, signature));
  if (recovered !== authorizedSender) {
    throw new Error(
      `Signature recovers ${recovered}, which does not match --sender ${authorizedSender}`,
    );
  }
  if (shouldWrite) {
    await writeFile(outputPath, `${JSON.stringify(draftEvidence, null, 2)}\n`, 'utf8');
    console.log(`Wrote verified Base Mainnet authorization to ${outputPath}`);
  }
}

console.log('=== EXACT EIP-191 MESSAGE TO SIGN ===');
console.log(messageToSign);
console.log('=====================================');
console.log('\n=== PREPARED AUTHORIZATION PAYLOAD ===');
console.log(JSON.stringify(draftEvidence, null, 2));
