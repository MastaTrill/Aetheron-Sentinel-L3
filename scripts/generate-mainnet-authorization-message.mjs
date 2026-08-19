#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const manifestPath = 'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const manifestText = await readFile(manifestPath, 'utf8');
const manifestSha256 = createHash('sha256').update(manifestText).digest('hex');

let commit = process.env.SENTINEL_RELEASE_COMMIT;
if (!commit) {
  try {
    commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    commit = '397f304e617739cbf52b5e9431c8a441afb73d6d';
  }
}

const sender = (process.env.AUTHORIZED_SENDER ?? '0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2').toLowerCase();
const maxGasCostWei = '10000000000000000'; // 0.01 ETH
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const messageLines = [
  'AETHERON SENTINEL BASE MAINNET AUTHORIZATION',
  `chainId:8453`,
  `manifestSha256:${manifestSha256.toLowerCase()}`,
  `authorizedCommit:${commit.toLowerCase()}`,
  `authorizedSender:${sender}`,
  `maxGasCostWei:${maxGasCostWei}`,
  `expiresAt:${expiresAt}`,
];

const message = messageLines.join('\n');

console.log('═'.repeat(60));
console.log('AETHERON SENTINEL L3 — BASE MAINNET AUTHORIZATION MESSAGE');
console.log('═'.repeat(60));
console.log(message);
console.log('═'.repeat(60));
console.log('\nParameters:');
console.log(`- Chain ID: 8453 (Base Mainnet)`);
console.log(`- Manifest SHA256: ${manifestSha256}`);
console.log(`- Release Commit: ${commit}`);
console.log(`- Authorized Sender: ${sender}`);
console.log(`- Max Gas Cost (Wei): ${maxGasCostWei}`);
console.log(`- Expires At: ${expiresAt}`);
console.log('═'.repeat(60));
