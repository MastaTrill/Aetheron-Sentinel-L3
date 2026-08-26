// scripts/deploy-and-patch-mainnet.cjs
// Usage: node scripts/deploy-and-patch-mainnet.cjs

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const DEPLOY_SCRIPT = path.join(__dirname, 'deploy.cjs');
const networkArgIndex = process.argv.indexOf('--network');
const NETWORK = networkArgIndex >= 0 && process.argv[networkArgIndex + 1] ? process.argv[networkArgIndex + 1] : 'mainnet';
const SUMMARY_MD = path.join(__dirname, '../DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md');
const OWNERSHIP_MD = path.join(__dirname, '../DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md');
const ENV_FILE = path.join(__dirname, '../.env.mainnet');

function runPreflight() {
  if (NETWORK !== 'mainnet') {
    return;
  }

  console.log('Running mainnet preflight before deployment...');
  execSync('npm run mainnet:preflight', {
    encoding: 'utf-8',
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });
}

function runDeployScript() {
  console.log(`Running deploy.cjs for ${NETWORK} using Hardhat CLI...`);
  // Use Hardhat CLI to ensure correct network and env
  const output = execSync(`npx hardhat run ${DEPLOY_SCRIPT} --network ${NETWORK}`, {
    encoding: 'utf-8',
    stdio: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });
  return output;
}

function extractJsonAddresses(output) {
  // Try to find the first valid JSON object in the output
  const lines = output.split(/\r?\n/);
  let jsonStr = '';
  let inJson = false;
  for (const line of lines) {
    if (!inJson && line.trim().startsWith('{')) {
      inJson = true;
      jsonStr = line.trim();
    } else if (inJson) {
      jsonStr += '\n' + line;
      if (line.trim().endsWith('}')) {
        // Try to parse
        try {
          return JSON.parse(jsonStr);
        } catch {
          // Not valid yet, keep going
        }
      }
    }
  }
  throw new Error('Could not find valid JSON addresses in deploy output');
}

function extractBlockNumber(output) {
  // Looks for a line like: 'Final Block: 12345678'
  const match = output.match(/Final Block:\s*(\d+)/);
  return match ? match[1] : null;
}

function patchFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`(${key}[:=] *)(.*)`, 'i');
    content = content.replace(regex, `$1${value}`);
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

function main() {
  runPreflight();
  const output = runDeployScript();
  const addresses = extractJsonAddresses(output);
  const blockNumber = extractBlockNumber(output) || 'TO FILL';

  // Print details to console
  console.log('--- Deployment Details ---');
  console.log('Network:', NETWORK);
  console.log('Block number:', blockNumber);
  console.log('Deployed addresses:', JSON.stringify(addresses, null, 2));
  console.log('--------------------------');

  // Write details to log file
  const logPath = path.join(__dirname, '../logs/deploy-mainnet-details.log');
  const logContent = [
    `Block number: ${blockNumber}`,
    'Deployed addresses:',
    JSON.stringify(addresses, null, 2),
    '',
  ].join('\n');
  fs.writeFileSync(logPath, logContent, 'utf-8');

  // Patch DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md
  patchFile(SUMMARY_MD, {
    'Final Block': blockNumber,
    Status: '✅ MAINNET DRY RUN COMPLETE',
  });

  // Patch DEPLOYMENT_OWNERSHIP_CHECKLIST_MAINNET.md (example: update owner/roles)
  patchFile(OWNERSHIP_MD, {
    'Deployed Addresses': JSON.stringify(addresses, null, 2),
  });

  // Patch .env.mainnet with DEPLOYED_ADDRESSES and START_BLOCK
  patchFile(ENV_FILE, {
    DEPLOYED_ADDRESSES: JSON.stringify(addresses),
    START_BLOCK: blockNumber,
  });

  console.log('Deployment and patching complete.');
}

main();
