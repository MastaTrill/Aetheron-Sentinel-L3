#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { Wallet, getAddress, isAddress } from 'ethers';

function normalizePrivateKey(value) {
  let normalized = String(value ?? '').trim().replace(/^\uFEFF/, '');
  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object') {
      normalized = String(parsed.DEPLOYER_PRIVATE_KEY || parsed.deployerPrivateKey || parsed.privateKey || parsed.PRIVATE_KEY || '').trim();
    }
  } catch {}
  while (normalized.length >= 2 && ((normalized.startsWith('\"') && normalized.endsWith('\"')) || (normalized.startsWith("'") && normalized.endsWith("'")))) {
    normalized = normalized.slice(1, -1).trim();
  }
  normalized = normalized.replace(/^(?:export\s+)?(?:DEPLOYER_PRIVATE_KEY|PRIVATE_KEY)\s*=\s*/i, '').trim();
  while (normalized.length >= 2 && ((normalized.startsWith('\"') && normalized.endsWith('\"')) || (normalized.startsWith("'") && normalized.endsWith("'")))) normalized = normalized.slice(1, -1).trim();
  normalized = normalized.replace(/\s+/g, '');
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) normalized = `0x${normalized}`;
  return normalized;
}

const protectedSignerSecret = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
const authorizationPath =
  process.env.SENTINEL_MAINNET_AUTHORIZATION ??
  'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json';

if (!/^0x[0-9a-f]{64}$/i.test(protectedSignerSecret ?? '')) {
  throw new Error('DEPLOYER_PRIVATE_KEY is missing or malformed in the protected environment');
}

const authorization = JSON.parse(await readFile(authorizationPath, 'utf8'));
const sender = authorization.authorization?.authorizedSender;
if (!isAddress(sender)) throw new Error('Authorization sender is malformed');

const protectedSigner = getAddress(new Wallet(protectedSignerSecret).address);
const authorizedSender = getAddress(sender);
if (protectedSigner !== authorizedSender) {
  throw new Error(
    `Protected deployment signer ${protectedSigner} does not match authorized sender ${authorizedSender}`
  );
}

console.log(`Protected SENTINEL deployer signer: PASS (${protectedSigner})`);
