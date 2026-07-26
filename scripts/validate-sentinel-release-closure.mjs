#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg?.split('=')[1] ?? 'readiness';
if (!['readiness', 'final'].includes(mode)) throw new Error('Use --mode=readiness or --mode=final');

const manifestPath = process.env.SENTINEL_RELEASE_CLOSURE_MANIFEST ?? 'release-evidence/sentinel-mainnet/release-closure.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const failures = [];
const pending = [];

if (manifest.chainId !== 8453) failures.push('chainId must be 8453');
if (manifest.token?.toLowerCase() !== '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3') failures.push('canonical token mismatch');

for (const file of manifest.requiredEvidenceFiles ?? []) {
  try { await access(file); } catch { failures.push(`missing required evidence file: ${file}`); }
}

for (const [name, gate] of Object.entries(manifest.gates ?? {})) {
  if (gate.status === 'complete') {
    for (const file of gate.evidence ?? []) {
      try { await access(file); } catch { failures.push(`${name}: missing evidence ${file}`); }
    }
  } else {
    pending.push(`${name}: ${gate.status}`);
  }
}

if (failures.length) {
  console.error('Release-closure manifest is invalid:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log(`Release-closure readiness structure is valid. Complete gates: ${Object.values(manifest.gates).filter((gate) => gate.status === 'complete').length}.`);
if (pending.length) console.log('Pending gates:\n- ' + pending.join('\n- '));
if (mode === 'final' && pending.length) process.exit(1);
