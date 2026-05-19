const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { JsonRpcProvider, Wallet, formatEther, parseEther } = require('ethers');

/**
 * Runs a node script and returns a promise that resolves when the script finishes.
 */
function runScript(scriptName) {
    return new Promise((resolve, reject) => {
        console.log(`\n--- Starting: ${scriptName} ---`);
        // Use npx tsx to handle advanced JS syntax/decorators
        const child = spawn('npx', ['tsx', path.join(__dirname, scriptName)], {
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${scriptName} exited with code ${code}`));
            }
        });
    });
}

async function main() {
    try {
        // Load environment variables early for pre-deployment checks
        require('dotenv').config({ path: path.join(__dirname, '../.env') });

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
                throw new Error(`Insufficient gas for deployment. Current: ${formatEther(balance)} ETH, Required: ${formatEther(minRequired)} ETH.`);
            }
            console.log(`💰 Balance OK: ${formatEther(balance)} ETH`);
        }

        // 1. Run Deployment (updates .env)
        await runScript('deploy.js');

        console.log('\n✅ Deployment successful. Verifying contract reachability...');

        // Reload environment variables to get new addresses
        require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });

        rpcUrl = process.env.MAINNET_RPC_URL || process.env.BASE_RPC_URL;
        const addresses = [
            process.env.INTERCEPTOR_ADDRESS,
            process.env.MONITOR_ADDRESS
        ].filter(Boolean);

        if (addresses.length === 0) {
            throw new Error('No contract addresses found in .env after deployment.');
        }

        const provider = new JsonRpcProvider(rpcUrl);
        let reachable = false;
        const maxAttempts = 5;

        for (let i = 1; i <= maxAttempts; i++) {
            console.log(`🔍 Verification attempt ${i}/${maxAttempts}...`);
            const results = await Promise.all(addresses.map(addr => provider.getCode(addr)));
            reachable = results.every(code => code !== '0x' && code !== '0x0');

            if (reachable) break;

            if (i < maxAttempts) {
                console.log('⏳ Contracts not yet reachable. Waiting 5s...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        if (!reachable) {
            throw new Error('Timeout: Contracts are not reachable on the network.');
        }

        // 2. Start the Sentinel Engine
        // This is a long-running process that listens for events
        await runScript('sentinel-engine.js');

    } catch (error) {
        console.error('\n❌ Startup sequence failed:', error.message);
        process.exit(1);
    }
}

main();