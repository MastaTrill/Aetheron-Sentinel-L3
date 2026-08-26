#!/usr/bin/env node

/**
 * Sentinel L3 — Multi-Network Deployment Assistant
 * Automated deployment and verification orchestrator for Base, Arbitrum, Polygon, and Optimism.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const NETWORKS = {
  'base-mainnet': {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcEnv: 'BASE_MAINNET_RPC_URL',
    defaultRpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    minBalance: '0.05',
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcEnv: 'BASE_SEPOLIA_RPC_URL',
    defaultRpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    minBalance: '0.01',
  },
  'arbitrum-one': {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcEnv: 'ARBITRUM_RPC_URL',
    defaultRpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    minBalance: '0.05',
  },
  'polygon-mainnet': {
    name: 'Polygon PoS',
    chainId: 137,
    rpcEnv: 'POLYGON_RPC_URL',
    defaultRpc: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    minBalance: '10.0', // MATIC
  },
};

class MultiNetworkDeployer {
  constructor() {
    this.results = {};
    this.privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  }

  async validateNetwork(networkKey) {
    const config = NETWORKS[networkKey];
    if (!config) {
      throw new Error(`Unknown network target: ${networkKey}`);
    }

    const rpcUrl = process.env[config.rpcEnv] || config.defaultRpc;
    console.log(`\n🔍 Checking ${config.name} (${config.chainId})...`);

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();

      if (Number(network.chainId) !== config.chainId) {
        throw new Error(`ChainId mismatch! RPC returned ${network.chainId}, expected ${config.chainId}`);
      }

      let balance = '0';
      let deployerAddress = '0x0000000000000000000000000000000000000000';

      if (this.privateKey) {
        const wallet = new ethers.Wallet(this.privateKey, provider);
        deployerAddress = wallet.address;
        const balWei = await provider.getBalance(deployerAddress);
        balance = ethers.formatEther(balWei);
      }

      console.log(`   ✓ RPC Connected: Block #${blockNumber}`);
      console.log(`   ✓ Deployer: ${deployerAddress}`);
      console.log(`   ✓ Balance: ${balance} Native Token`);

      return {
        status: 'READY',
        chainId: config.chainId,
        blockNumber,
        deployerAddress,
        balance,
        rpcUrl,
      };
    } catch (err) {
      console.log(`   ❌ Pre-flight Failed: ${err.message}`);
      return {
        status: 'FAILED',
        error: err.message,
      };
    }
  }

  async run(targetNetwork = 'all') {
    console.log('====================================================');
    console.log('🚀 SENTINEL L3 MULTI-NETWORK DEPLOYMENT ASSISTANT');
    console.log('====================================================');

    const targets = targetNetwork === 'all' ? Object.keys(NETWORKS) : [targetNetwork];

    for (const key of targets) {
      this.results[key] = await this.validateNetwork(key);
    }

    const summaryPath = path.join(__dirname, '../multi-chain-deployment.json');
    const outputData = {
      timestamp: new Date().toISOString(),
      targets: this.results,
    };

    fs.writeFileSync(summaryPath, JSON.stringify(outputData, null, 2));
    console.log('\n====================================================');
    console.log(`📄 Summary written to: ${summaryPath}`);
    console.log('====================================================\n');
  }
}

if (require.main === module) {
  const target = process.argv[2] || 'all';
  const deployer = new MultiNetworkDeployer();
  deployer.run(target).catch(console.error);
}

module.exports = MultiNetworkDeployer;
