// scripts/finalize-mainnet-release.cjs
// Usage: node scripts/finalize-mainnet-release.cjs

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_FILE = path.join(__dirname, '../.env.mainnet');
const SUMMARY_MD = path.join(
  __dirname,
  '../DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md',
);

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

function updateEnvStartBlock(startBlock) {
  let env = fs.readFileSync(ENV_FILE, 'utf-8');
  env = env.replace(/START_BLOCK=.*/g, `START_BLOCK=${startBlock}`);
  fs.writeFileSync(ENV_FILE, env, 'utf-8');
  console.log(`Updated START_BLOCK in .env.mainnet to ${startBlock}`);
}

function getDeployedAddresses() {
  const env = fs.readFileSync(ENV_FILE, 'utf-8');
  const match = env.match(/DEPLOYED_ADDRESSES=(\{[\s\S]*?\})/);
  if (match) return JSON.parse(match[1]);
  return null;
}

function updateSummaryMd(startBlock, addresses) {
  let md = fs.readFileSync(SUMMARY_MD, 'utf-8');
  md = md.replace(
    /(\*\*Final Block:)[^\n]*/g,
    `**Final Block:** ${startBlock}`,
  );
  // Insert addresses into Deployment Addresses section
  md = md.replace(/(## Deployment Addresses[\s\S]*?)(---)/, (m, p1, p2) => {
    return `${p1}\n\n\`\`\`json\n${JSON.stringify(addresses, null, 2)}\n\`\`\`\n\n${p2}`;
  });
  fs.writeFileSync(SUMMARY_MD, md, 'utf-8');
  console.log(
    'Updated Final Block and Deployment Addresses in DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md',
  );
}

async function main() {
  const startBlock = await prompt(
    'Enter the actual START_BLOCK (deployment block number): ',
  );
  updateEnvStartBlock(startBlock);
  let addresses = getDeployedAddresses();
  if (!addresses) {
    const addrStr = await prompt('Paste the contract address map as JSON: ');
    addresses = JSON.parse(addrStr);
  }
  updateSummaryMd(startBlock, addresses);

  const logsPath = await prompt(
    'Enter path to launch evidence/logs to attach to release PR (or leave blank to skip): ',
  );
  if (logsPath && fs.existsSync(logsPath)) {
    console.log(`\nAttach the following files to your release PR:`);
    const files = fs.readdirSync(logsPath).map((f) => path.join(logsPath, f));
    files.forEach((f) => console.log('  -', f));
  } else if (logsPath) {
    console.log('Path not found. Please check and attach logs manually.');
  } else {
    console.log('Skipped log attachment step.');
  }
  console.log('\nRelease finalization complete.');
}

main();
