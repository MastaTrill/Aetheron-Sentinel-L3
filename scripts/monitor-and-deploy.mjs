#!/usr/bin/env node
import { JsonRpcProvider, formatEther } from 'ethers';
import { execSync } from 'node:child_process';

const rpcUrl = 'https://mainnet.base.org';
const provider = new JsonRpcProvider(rpcUrl);
const deployer = '0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2';
const requiredWei = 48918595000000n; // 0.000049 ETH

console.log(`Checking balance for ${deployer} on Base Mainnet...`);
const balance = await provider.getBalance(deployer);
console.log(`Current Balance: ${formatEther(balance)} ETH (${balance.toString()} wei)`);

if (balance >= requiredWei) {
  console.log('✅ Sufficient balance detected! Executing Base Mainnet redeployment...');
  const env = {
    ...process.env,
    BASE_MAINNET_RPC_URL: rpcUrl,
    DEPLOYER_PRIVATE_KEY: '0xc8554fa973aa9722d7d8554c508a9ae8d943bed8ea594678afa0d427c28e6d0d',
    SENTINEL_RELEASE_COMMIT: '397f304e617739cbf52b5e9431c8a441afb73d6d',
    SENTINEL_MAINNET_DEPLOYMENT_OUTPUT: 'release-evidence/sentinel-mainnet/redeployment/deployment-receipt.json'
  };
  try {
    execSync('node scripts/execute-sentinel-base-mainnet-redeployment.mjs', { env, stdio: 'inherit' });
    console.log('🎉 Deployment succeeded!');
  } catch (err) {
    console.error('Deployment error:', err.message);
  }
} else {
  console.log(`⏳ Awaiting deposit. Deficit: ${formatEther(requiredWei - balance)} ETH.`);
}
