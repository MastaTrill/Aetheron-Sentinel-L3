#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { Interface, JsonRpcProvider, getAddress, hashMessage, verifyMessage } from 'ethers';

const manifestPath = process.env.SENTINEL_ATTESTATION_MANIFEST ?? 'release-evidence/sentinel-mainnet/attestations/manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const provider = new JsonRpcProvider(process.env.BASE_RPC_URL ?? 'https://base-rpc.publicnode.com', 8453, { staticNetwork: true });
const eip1271 = new Interface(['function isValidSignature(bytes32,bytes) view returns (bytes4)']);
const MAGIC_VALUE = '0x1626ba7e';
const failures = [];

for (const entry of manifest.attestations ?? []) {
  const address = getAddress(entry.beneficiary);
  if (entry.status !== 'signed') {
    failures.push(`${address}: attestation status is ${entry.status ?? 'missing'}`);
    continue;
  }
  if (!entry.message || !entry.signature) {
    failures.push(`${address}: missing message or signature`);
    continue;
  }
  if (entry.verificationMode === 'eip191') {
    const recovered = getAddress(verifyMessage(entry.message, entry.signature));
    if (recovered !== address) failures.push(`${address}: EIP-191 recovered ${recovered}`);
  } else if (entry.verificationMode === 'eip1271') {
    const data = eip1271.encodeFunctionData('isValidSignature', [hashMessage(entry.message), entry.signature]);
    const returned = await provider.call({ to: address, data });
    const [magic] = eip1271.decodeFunctionResult('isValidSignature', returned);
    if (magic.toLowerCase() !== MAGIC_VALUE) failures.push(`${address}: EIP-1271 returned ${magic}`);
  } else {
    failures.push(`${address}: unsupported verificationMode ${entry.verificationMode}`);
  }
}

await provider.destroy();
if (failures.length) {
  console.error('Beneficiary attestations are incomplete or invalid:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log(`Verified ${manifest.attestations.length} beneficiary attestations.`);
