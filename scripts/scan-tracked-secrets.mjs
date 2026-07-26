import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((path) => !path.endsWith('package-lock.json'))
  .filter((path) => !path.includes('/artifacts/'))
  .filter((path) => !path.includes('/cache/'));

const findings = [];
const rules = [
  ['raw EVM private key', /(?:^|[=:\s"'])(0x[a-fA-F0-9]{64})(?:$|[\s,"'])/g],
  ['mnemonic phrase assignment', /(?:mnemonic|seed phrase|seed_phrase)\s*[:=]\s*["'][^"']{20,}["']/gi],
  ['authenticated RPC URL', /https?:\/\/[^\s"']+:[^\s"']+@[^\s"']+/g],
  ['common API secret assignment', /(?:api[_-]?key|secret|private[_-]?key|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-\/+=]{20,}["']/gi],
];

for (const path of files) {
  let text;
  try { text = fs.readFileSync(path, 'utf8'); } catch { continue; }
  for (const [name, pattern] of rules) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) findings.push(`${path}: ${name}`);
  }
}

if (findings.length) {
  console.error('Potential secrets detected. Review and rotate before merging:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Tracked secret scan passed across ${files.length} files.`);
