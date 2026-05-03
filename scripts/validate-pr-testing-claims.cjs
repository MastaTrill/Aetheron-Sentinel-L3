#!/usr/bin/env node
const fs = require('node:fs');

const bodyPath = process.argv[2];
if (!bodyPath) {
  console.error('Usage: node scripts/validate-pr-testing-claims.cjs <pr-body-file>');
  process.exit(2);
}

const body = fs.readFileSync(bodyPath, 'utf8');
if (!body.trim()) {
  console.error('PR body is empty. Include Summary and Testing details.');
  process.exit(1);
}
const normalized = body.toLowerCase();

const bannedPhrases = [
  'all tests passed',
  'tests passed successfully',
  'suite completed successfully',
  'observed all tests pass',
  'confirmed compilation completes',
];

for (const phrase of bannedPhrases) {
  if (normalized.includes(phrase)) {
    console.error(`Ambiguous testing claim found: "${phrase}"`);
    console.error('Use explicit command evidence or mark entries as "not run locally".');
    process.exit(1);
  }
}

const testingSection = body.match(/(?:^|\n)#{2,3}\s*Testing\s*\n([\s\S]*)/i);
if (!testingSection) {
  console.error('Missing "## Testing" (or "### Testing") section in PR body.');
  process.exit(1);
}

const testingText = testingSection[1];
const hasInlineCommand = /`[^`\n]+`/.test(testingText);
const hasCodeBlockCommand =
  /```[\s\S]*?(npm|npx|node|python|pytest|yarn|pnpm|cargo|go test|make)\b[\s\S]*?```/i.test(
    testingText
  );
const hasBulletedCommand =
  /^\s*[-*]\s+(npm|npx|node|python|pytest|yarn|pnpm|cargo|go test|make)\b/im.test(testingText);
const hasCommandEvidence = hasInlineCommand || hasCodeBlockCommand || hasBulletedCommand;
const hasNotRunLocally = /not run locally/i.test(testingText);

if (!hasCommandEvidence && !hasNotRunLocally) {
  console.error(
    'Testing section must include command evidence or explicit "not run locally" statements.'
  );
  process.exit(1);
}

console.log('PR testing claims validation passed.');
