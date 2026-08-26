import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_FILE = path.join(__dirname, '../.env.mainnet');
const SUMMARY_MD = path.join(__dirname, '../DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md');
const DATA_JSON = path.join(__dirname, '../mainnet-deployment-data.json');

function updateEnvStartBlock(startBlock, addresses) {
  if (!fs.existsSync(ENV_FILE)) {
    fs.writeFileSync(
      ENV_FILE,
      `START_BLOCK=${startBlock}\nDEPLOYED_ADDRESSES=${JSON.stringify(addresses)}\n`,
      'utf-8'
    );
    return;
  }
  let env = fs.readFileSync(ENV_FILE, 'utf-8');
  if (env.match(/START_BLOCK=.*/)) {
    env = env.replace(/START_BLOCK=.*/g, `START_BLOCK=${startBlock}`);
  } else {
    env += `\nSTART_BLOCK=${startBlock}`;
  }
  if (env.match(/DEPLOYED_ADDRESSES=.*/)) {
    env = env.replace(/DEPLOYED_ADDRESSES=.*/g, `DEPLOYED_ADDRESSES=${JSON.stringify(addresses)}`);
  } else {
    env += `\nDEPLOYED_ADDRESSES=${JSON.stringify(addresses)}`;
  }
  fs.writeFileSync(ENV_FILE, env, 'utf-8');
  console.log(`Updated START_BLOCK in .env.mainnet to ${startBlock}`);
}

function updateSummaryMd(startBlock, addresses) {
  if (!fs.existsSync(SUMMARY_MD)) {
    fs.writeFileSync(
      SUMMARY_MD,
      `# Mainnet Deployment Summary\n\n**Final Block:** ${startBlock}\n\n## Deployment Addresses\n\n\`\`\`json\n${JSON.stringify(addresses, null, 2)}\n\`\`\`\n\n---\n`,
      'utf-8'
    );
    return;
  }
  let md = fs.readFileSync(SUMMARY_MD, 'utf-8');
  if (md.match(/(\*\*Final Block:)[^\n]*/)) {
    md = md.replace(/(\*\*Final Block:)[^\n]*/g, `**Final Block:** ${startBlock}`);
  }
  if (md.match(/(## Deployment Addresses[\s\S]*?)(---)/)) {
    md = md.replace(/(## Deployment Addresses[\s\S]*?)(---)/, (m, p1, p2) => {
      return `${p1}\n\n\`\`\`json\n${JSON.stringify(addresses, null, 2)}\n\`\`\`\n\n${p2}`;
    });
  }
  fs.writeFileSync(SUMMARY_MD, md, 'utf-8');
  console.log(
    'Updated Final Block and Deployment Addresses in DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md'
  );
}

async function main() {
  if (!fs.existsSync(DATA_JSON)) {
    console.error('Missing mainnet-deployment-data.json');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const startBlock = data.contracts.SentinelCore.block || 1;
  const addresses = {
    SentinelCore: data.contracts.SentinelCore.address,
    SentinelCoreLoop: data.contracts.SentinelCoreLoop.address,
    AetheronBridge: data.contracts.AetheronBridge.address,
    SentinelChainlinkKeeper: data.contracts.SentinelChainlinkKeeper.address,
  };
  updateEnvStartBlock(startBlock, addresses);
  updateSummaryMd(startBlock, addresses);

  console.log('\\nRelease finalization complete.');
}

main();
