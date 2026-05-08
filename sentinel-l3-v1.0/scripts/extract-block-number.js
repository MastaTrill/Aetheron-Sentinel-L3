// scripts/extract-block-number.js
// Usage: node scripts/extract-block-number.js logs/deploy-mainnet.log
// scripts/extract-block-number.cjs
// Usage: node scripts/extract-block-number.cjs logs/deploy-mainnet.log

const fs = require('fs');

if (process.argv.length < 3) {
  console.error('Usage: node scripts/extract-block-number.js <logfile>');
  process.exit(1);
}

const logFile = process.argv[2];

try {
  const data = fs.readFileSync(logFile, 'utf8');
  const lines = data.split(/\r?\n/);
  const blockRegex = /block(?:\s*number)?[:=]?\s*(\d{5,})/i;
  for (const line of lines) {
    const match = line.match(blockRegex);
    if (match) {
      console.log('Block number found:', match[1]);
      process.exit(0);
    }
  }
  console.error('No block number found in log file.');
  process.exit(2);
} catch (err) {
  console.error('Error reading log file:', err.message);
  process.exit(1);
}
