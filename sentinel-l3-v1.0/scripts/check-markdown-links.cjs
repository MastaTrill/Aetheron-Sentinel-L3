#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const targets = [
  'DOCUMENTATION_INDEX.md',
  'DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md',
  'RELEASE_NOTES_MAINNET_2026-04-27.md',
  'docs/CI_EXECUTION_EVIDENCE.md',
  'docs/MAINNET_EVIDENCE_CHECKLIST.md',
];

const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
let failed = false;

for (const relFile of targets) {
  const absFile = path.join(repoRoot, relFile);
  const content = fs.readFileSync(absFile, 'utf8');
  const baseDir = path.dirname(absFile);

  for (const match of content.matchAll(linkRegex)) {
    const raw = match[1].trim();
    if (
      !raw ||
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('mailto:')
    ) {
      continue;
    }
    const linkPath = raw.split('#')[0];
    if (!linkPath || linkPath.startsWith('<')) continue;

    const resolved = path.resolve(baseDir, linkPath);
    if (!fs.existsSync(resolved)) {
      failed = true;
      console.error(`Broken link in ${relFile}: ${raw}`);
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log('Markdown link check passed.');
