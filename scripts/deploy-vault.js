/**
 * Sentinel L3 — SentinelVaultStrategy Deployment Script
 * Deploy to Base Mainnet via: node scripts/deploy-vault.cjs
 *
 * Prerequisites (.env):
 *   BASE_MAINNET_RPC_URL=https://mainnet.base.org
 *   DEPLOYER_PRIVATE_KEY=0x...your_wallet_private_key...
 *   BASESCAN_API_KEY=...your_basescan_api_key...
 *
 * The SENTINEL token address on Base Mainnet:
 *   0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Sentinel token on Base Mainnet (canonical)
const SENTINEL_TOKEN_BASE = '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3';

async function main() {
  const { network, ethers } = await import('hardhat');

  console.log('🌊 SentinelVaultStrategy — Base Mainnet Deployment');
  console.log('===================================================');
  console.log(`📡 Network: ${network.name} (Chain ID: ${(await ethers.provider.getNetwork()).chainId})`);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log(`👛 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther('0.005')) {
    console.error('\n❌ Insufficient ETH balance. Need at least 0.005 ETH for gas fees.');
    process.exit(1);
  }

  console.log('\n🔨 Deploying SentinelVaultStrategy...');
  const Factory = await ethers.getContractFactory('SentinelVaultStrategy');
  const vault = await Factory.deploy(SENTINEL_TOKEN_BASE, deployerAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  const deployTx = vault.deploymentTransaction();

  console.log('\n===================================================');
  console.log('✅ DEPLOYMENT SUCCESSFUL');
  console.log('===================================================');
  console.log(`📄 Contract Address:  ${vaultAddress}`);
  console.log(`🔗 Transaction Hash:  ${deployTx.hash}`);
  console.log(`🌐 BaseScan URL:      https://basescan.org/address/${vaultAddress}`);
  console.log('===================================================\n');

  // Save deployment record
  const { writeFileSync, existsSync, mkdirSync } = require('fs');
  const { join } = require('path');

  const deploymentsDir = join(process.cwd(), 'deployments');
  if (!existsSync(deploymentsDir)) mkdirSync(deploymentsDir, { recursive: true });

  const record = {
    contractName: 'SentinelVaultStrategy',
    address: vaultAddress,
    stakingToken: SENTINEL_TOKEN_BASE,
    deployer: deployerAddress,
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    txHash: deployTx.hash,
    deployedAt: new Date().toISOString()
  };

  writeFileSync(
    join(deploymentsDir, 'SentinelVaultStrategy-base.json'),
    JSON.stringify(record, null, 2)
  );

  console.log('📁 Deployment record saved to: deployments/SentinelVaultStrategy-base.json');
  console.log('\n💡 Next step — verify the contract on BaseScan:');
  console.log(`   npx hardhat verify --network base ${vaultAddress} "${SENTINEL_TOKEN_BASE}" "${deployerAddress}"\n`);
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});
