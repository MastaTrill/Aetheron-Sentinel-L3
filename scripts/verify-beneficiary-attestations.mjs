#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { Interface, JsonRpcProvider, getAddress, hashMessage, verifyMessage } from 'ethers';

const manifestPath = process.env.SENTINEL_ATTESTATION_MANIFEST ?? 'release-evidence/sentinel-mainnet/attestations/manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const provider = new JsonRpcProvider(process.env.BASE_RPC_URL ?? 'https://base-rpc.publicnode.com', 8453, { staticNetwork: true });
const eip1271 = new Interface(['function isValidSignature(bytes32,bytes) view returns (bytes4)']);
const MAGIC_VALUE = '0x1626ba7e';
const failures = [];
const accepted = [];
const blocked = [];

const isSoloCreator = manifest.model === 'solo-creator' || manifest.schemaVersion >= 2;

for (const entry of manifest.attestations ?? []) {
  const address = getAddress(entry.beneficiary);
  const status = entry.status ?? 'missing';

  if (status === 'residual-risk-accepted') {
    if (!isSoloCreator) {
      failures.push(`${address}: residual-risk-accepted is only valid under solo-creator model`);
    } else {
      accepted.push(`${address}: residual risk accepted (${entry.role ?? 'unknown role'})`);
    }
    continue;
  }

  if (status === 'blocked-no-control') {
    if (!entry.remediationPath) {
      failures.push(`${address}: blocked-no-control requires a remediationPath`);
    } else {
      blocked.push(`${address}: owner confirmed non-control; remediation via ${entry.remediationPath}`);
    }
    continue;
  }

  if (status !== 'signed') {
    // Under solo-creator model only the primary (Creator) entry must be signed.
    if (isSoloCreator && entry.primary !== true) {
      failures.push(`${address}: non-primary entry must be signed or residual-risk-accepted`);
    } else {
      failures.push(`${address}: attestation status is ${status}`);
    }
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

if (isSoloCreator) {
  const primary = (manifest.attestations ?? []).find((e) => e.primary === true);
  if (!primary) {
    failures.push('solo-creator model requires exactly one primary attestation entry');
  } else if (primary.status === 'blocked-no-control' && primary.remediationPath) {
    // Primary attestation is blocked but has a valid remediation path — not a failure.
  } else if (primary.status !== 'signed') {
    failures.push(`primary Creator attestation (${primary.beneficiary}) is not signed`);
  }
}

if (failures.length) {
  console.error('Beneficiary attestations are incomplete or invalid:\n- ' + failures.join('\n- '));
  process.exit(1);
}

const signedCount = (manifest.attestations ?? []).filter((e) => e.status === 'signed').length;
if (blocked.length) {
  console.log(`Blocked attestations (remediation required):\n- ${blocked.join('\n- ')}`);
}
if (signedCount > 0) {
  console.log(`Verified ${signedCount} signed beneficiary attestation(s).`);
}
if (accepted.length) {
  console.log(`Residual risk accepted:\n- ${accepted.join('\n- ')}`);
}
if (!failures.length && blocked.length) {
  console.log('\nAttestation gate defers to the controlled redeployment path.');
}
