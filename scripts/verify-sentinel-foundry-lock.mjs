#!/usr/bin/env node
// Read-only verification: every Foundry lock revision must equal the committed gitlink.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const lock = JSON.parse(readFileSync('foundry.lock', 'utf8'));
let errors = 0;
for (const [path, entry] of Object.entries(lock)) {
  const pinned = entry.rev ?? entry.tag?.rev;
  if (!/^[0-9a-f]{40}$/i.test(pinned ?? '')) {
    console.error(`Invalid or missing lock revision: ${path}`); errors++; continue;
  }
  const tree = execFileSync('git', ['ls-tree', 'HEAD', '--', path], { encoding: 'utf8' }).trim();
  const match = /^160000 commit ([0-9a-f]{40})\t/.exec(tree);
  if (!match || match[1].toLowerCase() !== pinned.toLowerCase()) {
    console.error(`Gitlink mismatch: ${path}; pinned=${pinned}; gitlink=${match?.[1] ?? 'missing'}`);
    errors++;
  } else {
    console.log(`Verified ${path}: ${pinned}`);
  }
}
if (errors) process.exitCode = 1;
