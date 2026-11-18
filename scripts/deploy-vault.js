/**
 * Sentinel L3 — SentinelVaultStrategy Deployment Script
 *
 * NOTE: Legacy Base Mainnet SENTINEL (0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3)
 * is classified as legacy-non-canonical under controlled redeployment.
 * You MUST explicitly set SENTINEL_TOKEN_ADDRESS in the environment before deploying.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const LEGACY_SENTINEL_TOKEN_BASE = '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3';
const SENTINEL_TOKEN_BASE = process.env.SENTINEL_TOKEN_ADDRESS;

async function main() {
  if (!SENTINEL_TOKEN_BASE) {
    throw new Error(
      `SENTINEL_TOKEN_ADDRESS must be explicitly provided. Legacy token ${LEGACY_SENTINEL_TOKEN_BASE} is non-canonical under controlled redeployment.`
    );
  }

  const { network, ethers } = await import('hardhat');

  console.log('🌊 SentinelVaultStrategy — Deployment');
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
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});
