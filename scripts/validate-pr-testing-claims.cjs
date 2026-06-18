
const fs = require('node:fs');
const path = require('node:path');

function main() {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('Usage: node validate-pr-testing-claims.cjs <pr-body-file>');
    process.exit(1);
  }

  const body = fs.readFileSync(filePath, 'utf8');

  const hasSummary = /^## Summary/m.test(body);
  const testingMatch = body.match(/^#{2,3} (Testing|Validation)/m);
  const hasTesting = !!testingMatch;

  if (!hasSummary || !hasTesting) {
    process.exit(1);
  }

  const testingSection = body.slice(testingMatch.index + testingMatch[0].length).split(/^#{1,4} /m)[0];

  const backtick = String.fromCharCode(96);
  const hasFencedCommands = new RegExp(backtick + backtick + backtick + 'bash[\\s\\S]*?' + backtick + backtick + backtick).test(testingSection);
  const hasInlineCommands = new RegExp(backtick + '[^' + backtick + ']+' + backtick).test(testingSection);
  const hasCommandLines = /(^|\n)-?\s*`?((npm|yarn|pnpm|forge|hardhat|git|node|next|eslint|prettier)\s+[^\n`]+)/m.test(testingSection);
  const hasCommands = hasFencedCommands || hasInlineCommands || hasCommandLines;
  const hasNotRun = /not run locally/i.test(testingSection);
  const hasResults = /tests passed|all passed/i.test(testingSection);

  if (hasCommands || hasNotRun || hasResults) {
    process.exit(0);
  }

  process.exit(1);
}

main();
