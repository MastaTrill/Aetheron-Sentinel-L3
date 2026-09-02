#!/usr/bin/env node
import { JsonRpcProvider, formatEther } from 'ethers';

const rpcUrl = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
const provider = new JsonRpcProvider(rpcUrl);
const deployer = '0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2';
const requiredWei = 48918595000000n; // 0.000049 ETH

console.log(`Checking balance for ${deployer} on Base Mainnet...`);
const balance = await provider.getBalance(deployer);
console.log(`Current Balance: ${formatEther(balance)} ETH (${balance.toString()} wei)`);

if (balance >= requiredWei) {
  console.log('Funding threshold is satisfied.');
  console.log('No automatic mainnet deployment will be executed from this monitor.');
  console.log('Use the protected Base Mainnet release workflow only after the repository authorization and evidence gates are satisfied.');
} else {
  console.log(`Awaiting deposit. Deficit: ${formatEther(requiredWei - balance)} ETH.`);
}
