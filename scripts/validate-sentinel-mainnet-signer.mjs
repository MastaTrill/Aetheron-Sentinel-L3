#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { Wallet, getAddress, isAddress } from 'ethers';

const protectedSignerSecret = process.env.DEPLOYER_PRIVATE_KEY;
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
