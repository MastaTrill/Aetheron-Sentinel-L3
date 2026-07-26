import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((path) => !path.endsWith('package-lock.json'))
  .filter((path) => !path.includes('/artifacts/'))
  .filter((path) => !path.includes('/cache/'));

const findings = [];

const strongEvmPrivateKey =
  /(?:private[_-]?key|owner[_-]?private[_-]?key|deployer[_-]?(?:private[_-]?)?key|signer[_-]?(?:private[_-]?)?key|\bpk\b)\s*[:=]\s*["']?(?:0x)?[a-fA-F0-9]{64}(?:["']|\s|$)/i;
const rawEvmWord = /(?:^|[=:\s"'])(0x[a-fA-F0-9]{64})(?:$|[\s,"'])/;
const evmHashContext =
  /(?:hash|tx|transaction|role|slot|salt|topic|digest|proof|pool.?id|bytes32|commit|sha|merkle|selector|calldata|\bdata\b|root|storage|event|action|signature|initializ)/i;
const zeroBytes32 = /0x0{64}/i;
const mnemonicAssignment =
  /(?:mnemonic|seed phrase|seed_phrase)\s*[:=]\s*["'][^"']{20,}["']/i;
const authenticatedRpcUrl =
  /https?:\/\/[^/\s"'@:]+:[^/\s"'@]+@[^/\s"']+/i;
const commonApiSecretAssignment =
  /(?:api[_-]?key|secret|private[_-]?key|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-\/\+\=]{20,}["']/i;

for (const path of files) {
  let text;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch {
    continue;
  }

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (strongEvmPrivateKey.test(line)) {
      findings.push({ path, line: lineNumber, rule: 'EVM private key assignment' });
    } else if (
      rawEvmWord.test(line) &&
      !evmHashContext.test(line) &&
      !zeroBytes32.test(line)
    ) {
      findings.push({ path, line: lineNumber, rule: 'unlabeled raw 32-byte EVM value' });
    }

    if (mnemonicAssignment.test(line)) {
      findings.push({ path, line: lineNumber, rule: 'mnemonic phrase assignment' });
    }
    if (authenticatedRpcUrl.test(line)) {
      findings.push({ path, line: lineNumber, rule: 'authenticated RPC URL' });
    }
    if (commonApiSecretAssignment.test(line)) {
      findings.push({ path, line: lineNumber, rule: 'common API secret assignment' });
    }
  }
}

const reportLines = findings.length
  ? [
      'Potential tracked-secret findings (values redacted):',
      ...findings.map((finding) => `${finding.path}:${finding.line}: ${finding.rule}`),
    ]
  : [`Tracked secret scan passed across ${files.length} files.`];

const report = `${reportLines.join('\n')}\n`;
const reportPath = process.env.SECRET_SCAN_REPORT_PATH;
if (reportPath) fs.writeFileSync(reportPath, report, 'utf8');

if (findings.length) {
  console.error(report.trimEnd());
  console.error('Review each location and rotate any real credential before merging.');
  process.exit(1);
}

console.log(report.trimEnd());
