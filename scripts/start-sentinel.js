const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { JsonRpcProvider, Wallet, formatEther, parseEther } = require('ethers');
const dotenv = require('dotenv');

/**
 * Runs a node script and returns a promise that resolves when the script finishes.
 * @param {string} scriptName - The name of the script to run.
 * @param {boolean} [detached=false] - If true, the child process will be detached and the parent won't wait for it.
 */
function runScript(scriptName, detached = false) {
  return new Promise((resolve, reject) => {
    console.log(`\n--- Starting: ${scriptName} ---`);
    // Use npx tsx to handle advanced JS syntax/decorators
    const child = spawn('npx', ['tsx', path.join(__dirname, scriptName)], {
      stdio: detached ? 'ignore' : 'inherit', // Ignore stdio for detached processes
      detached: detached,
      shell: true,
    });

    if (detached) {
      child.unref(); // Allow the parent to exit independently
      console.log(`✅ ${scriptName} launched in background.`);
      return resolve();
    }

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} exited with code ${code}`));
      }
    });
  });
}

function loadEnv() {
  const envConfig = dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
  if (envConfig.error) {
    console.warn(
      '⚠️ .env file not found or could not be loaded. Ensure it exists and is correctly formatted.'
    );
  }
}

async function main() {
  try {
    // Load environment variables early for pre-deployment checks
    loadEnv();

    let rpcUrl = process.env.MAINNET_RPC_URL || process.env.BASE_RPC_URL;
    const privateKey = process.env.OWNER_PRIVATE_KEY;

    if (rpcUrl && privateKey && privateKey.startsWith('0x')) {
      const provider = new JsonRpcProvider(rpcUrl);
      const wallet = new Wallet(privateKey, provider);
      const address = await wallet.getAddress();

      console.log(`\n🔍 Pre-deployment balance check for: ${address}`);
      const balance = await provider.getBalance(address);
      const minGasEth = process.env.MIN_DEPLOY_GAS || '0.05';
      const minRequired = parseEther(minGasEth);

      if (balance < minRequired) {
        throw new Error(
          `Insufficient gas for deployment. Current: ${formatEther(balance)} ETH, Required: ${formatEther(minRequired)} ETH.`
        );
      }
      console.log(`💰 Balance OK: ${formatEther(balance)} ETH`);
    }

    // 1. Run Deployment (updates .env)
    await runScript('deploy.js');

    console.log('\n✅ Deployment successful. Verifying contract reachability...');

    // Reload environment variables to get new addresses
    loadEnv();

    rpcUrl = process.env.MAINNET_RPC_URL || process.env.BASE_RPC_URL;
    const addresses = [
      process.env.SENTINEL_CORE_ADDRESS, // Added for more comprehensive verification
      process.env.SENTINEL_CORE_LOOP_ADDRESS, // Added for more comprehensive verification
      process.env.INTERCEPTOR_ADDRESS,
      process.env.MONITOR_ADDRESS,
    ].filter(Boolean);

    if (addresses.length === 0) {
      throw new Error('No contract addresses found in .env after deployment.');
    }

    const provider = new JsonRpcProvider(rpcUrl);
    let reachable = false;
    const maxAttempts = 5;
    let unreachableContracts = [];

    for (let i = 1; i <= maxAttempts; i++) {
      console.log(`🔍 Verification attempt ${i}/${maxAttempts}...`);
      const results = await Promise.all(addresses.map(addr => provider.getCode(addr)));
      unreachableContracts = addresses.filter(
        (addr, index) => results[index] === '0x' || results[index] === '0x0'
      );
      reachable = unreachableContracts.length === 0;

      if (reachable) break;

      if (i < maxAttempts) {
        console.log(
          `⏳ Some contracts not yet reachable: ${unreachableContracts.join(', ')}. Waiting 5s...`
        );
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!reachable) {
      throw new Error(
        `Timeout: The following contracts are not reachable on the network: ${unreachableContracts.join(', ')}`
      );
    }

    if (!reachable) {
      throw new Error('Timeout: Contracts are not reachable on the network.');
    }

    // 2. Start the Sentinel Engine
    // This is a long-running process that listens for events
    runScript('sentinel-engine.js', true); // Launch in detached mode
  } catch (error) {
    console.error('\n❌ Startup sequence failed:', error.message);
    process.exit(1);
  }
}

main();
