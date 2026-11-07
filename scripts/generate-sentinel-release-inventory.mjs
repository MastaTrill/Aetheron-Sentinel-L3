#!/usr/bin/env node
// Offline, read-only release evidence inventory. Does not authorize deployment.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const lock = JSON.parse(await readFile('foundry.lock', 'utf8'));
const required = ['lib/forge-std', 'lib/openzeppelin-contracts', 'lib/chainlink-brownie-contracts'];
const dependencies = required.map(path => ({ path, pinnedRevision: lock[path]?.rev ?? lock[path]?.tag?.rev ?? null }));
const evidence = {
  schemaVersion: 1, commit: head, generatedAtUtc: new Date().toISOString(),
  scope: 'read-only-offline-evidence-inventory',
  dependencies,
  gates: {
    independentQuoteSignerApproved: 'unverified',
    independentAnchorContractReviewed: 'unverified',
    pretradeQuoteAnchorReceipts: 'missing',
    independentDeploymentReview: 'missing',
    beneficiaryAuthorityVerification: 'unverified',
    mainnetDeploymentAuthorization: 'not-authorized',
    mainnetSmokeTradeAuthorization: 'not-authorized',
  },
  verdict: 'HOLD',
};
const target = process.env.SENTINEL_EVIDENCE_OUTPUT ?? 'artifacts/sentinel-release-gate-inventory.json';
await mkdir('artifacts', { recursive: true });
if (!target.startsWith('artifacts/') || target.includes('..')) throw new Error('Evidence output must remain inside artifacts/');
await writeFile(target, JSON.stringify(evidence, null, 2) + '\n');
console.log('Read-only release evidence inventory generated: ' + target + ' (HOLD)');
