#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const signoffPath = process.env.SENTINEL_INDEPENDENT_SIGNOFF
  ?? 'release-evidence/sentinel-mainnet/independent-review/signoff.json';

const signoff = JSON.parse(await readFile(signoffPath, 'utf8'));
const failures = [];

function requireText(name, value, minimumLength = 1) {
  if (typeof value !== 'string' || value.trim().length < minimumLength) {
    failures.push(`${name} is missing or too short`);
    return;
  }
  if (/[<>]/.test(value) || /\b(TBD|TODO|PLACEHOLDER)\b/i.test(value)) {
    failures.push(`${name} contains a placeholder`);
  }
}

if (signoff.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (signoff.status !== 'signed') failures.push(`status must be signed, found ${signoff.status ?? 'missing'}`);
requireText('reviewerName', signoff.reviewerName, 2);
requireText('reviewerContact', signoff.reviewerContact, 3);
requireText('independenceStatement', signoff.independenceStatement, 40);
requireText('signatureReference', signoff.signatureReference, 8);

if (typeof signoff.reviewedCommit !== 'string' || !/^[0-9a-f]{40}$/i.test(signoff.reviewedCommit)) {
  failures.push('reviewedCommit must be an exact 40-character commit SHA');
}

if (typeof signoff.reviewedAtUtc !== 'string' || Number.isNaN(Date.parse(signoff.reviewedAtUtc))) {
  failures.push('reviewedAtUtc must be a valid timestamp');
}

if (signoff.decision !== 'approve') {
  failures.push(`decision must be approve for final release, found ${signoff.decision ?? 'missing'}`);
}

if (!Array.isArray(signoff.methods) || signoff.methods.length < 2) {
  failures.push('methods must contain at least two independent review methods');
}
if (!Array.isArray(signoff.evidenceReviewed) || signoff.evidenceReviewed.length < 5) {
  failures.push('evidenceReviewed must list at least five reviewed evidence items');
}
if (!Array.isArray(signoff.findings) || signoff.findings.length < 1) {
  failures.push('findings must contain at least one review finding');
}
if (!Array.isArray(signoff.unresolvedRisks)) {
  failures.push('unresolvedRisks must be an array, even when empty');
}

if (failures.length) {
  console.error('Independent sign-off is incomplete or invalid:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log(`Independent sign-off verified for commit ${signoff.reviewedCommit} by ${signoff.reviewerName}.`);
