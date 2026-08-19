#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { getAddress, isAddress, verifyMessage } from 'ethers';

const sigArg = process.argv.find(arg => arg.startsWith('--signature='));
const signature = sigArg ? sigArg.split('=')[1] : process.env.AUTHORIZATION_SIGNATURE;

const senderArg = process.argv.find(arg => arg.startsWith('--sender='));
const sender = (senderArg ? senderArg.split('=')[1] : process.env.AUTHORIZED_SENDER ?? '0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2').trim();

const commitArg = process.argv.find(arg => arg.startsWith('--commit='));
const commit = (commitArg ? commitArg.split('=')[1] : process.env.SENTINEL_RELEASE_COMMIT ?? '397f304e617739cbf52b5e9431c8a441afb73d6d').trim();

const expiresArg = process.argv.find(arg => arg.startsWith('--expires='));
const expiresAt = (expiresArg ? expiresArg.split('=')[1] : '2026-08-21T05:18:07.464Z').trim();

const maxGasCostWei = '10000000000000000';

const manifestPath = 'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const manifestText = await readFile(manifestPath, 'utf8');
const manifestSha256 = createHash('sha256').update(manifestText).digest('hex');

if (!signature || !/^0x[0-9a-f]{130}$/i.test(signature)) {
  console.error('Usage: node scripts/apply-mainnet-authorization.mjs --signature=0x<65-byte-sig> [--sender=0x...] [--commit=...] [--expires=...]');
  process.exit(1);
}

const authPath = 'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json';
const lower = value => (typeof value === 'string' ? value.toLowerCase() : '');

const message = [
  'AETHERON SENTINEL BASE MAINNET AUTHORIZATION',
  `chainId:8453`,
  `manifestSha256:${manifestSha256.toLowerCase()}`,
  `authorizedCommit:${commit.toLowerCase()}`,
  `authorizedSender:${sender.toLowerCase()}`,
  `maxGasCostWei:${maxGasCostWei}`,
  `expiresAt:${expiresAt}`,
].join('\n');

const recovered = getAddress(verifyMessage(message, signature));
if (recovered.toLowerCase() !== sender.toLowerCase()) {
  console.error(`Signature verification failed: recovered ${recovered}, expected ${sender}`);
  process.exit(1);
}

const authData = {
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
    authorizedSender: getAddress(sender),
    authorizedAtUtc: new Date().toISOString(),
    authorizedCommit: commit,
    reference: 'https://github.com/MastaTrill/Aetheron-Sentinel-L3/pull/262',
    signature,
    method: 'cryptographic-signature',
  },
  notice: 'Base Mainnet broadcast authorization validated with active cryptographic wallet signature.',
  riskAcceptance: {
    proceedWithoutIndependentSecurityReview: true,
    acceptedBy: getAddress(sender),
    acceptedAtUtc: new Date().toISOString(),
    statement: 'I accept the risk of proceeding without an independent security review for this exact commit and manifest.',
  },
};

await writeFile(authPath, JSON.stringify(authData, null, 2) + '\n', 'utf8');
console.log('✅ mainnet-authorization.json successfully updated and cryptographically verified!');
