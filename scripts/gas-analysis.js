import hardhatModule from 'hardhat';
const hre = hardhatModule.default ?? hardhatModule;
const { ethers } = hre;

async function analyzeGasUsage() {
  console.log('⛽ Gas Usage Analysis for Aetheron Sentinel L3');
  console.log('============================================\n');

  const connection = await hre.network.getOrCreate();
  const { ethers } = connection;

  // Get contract factories
  const contracts = [
    'SentinelCore',
    'SentinelToken',
    'SentinelStaking',
    'SentinelAMM',
    'SentinelOracleNetwork',
    'SentinelMultiSigVault',
    'SentinelTimelock',
    'SentinelGovernance',
    'AetheronBridge',
    'RateLimiter',
    'CircuitBreaker',
    'SentinelInterceptor',
  ];

  const [owner] = await ethers.getSigners();
  const ownerAddress = owner.address;
  const mockAddress = '0x0000000000000000000000000000000000000001';

  const contractArgs = {
    SentinelCore: [ownerAddress],
    SentinelToken: [ownerAddress],
    SentinelAMM: [ownerAddress],
    SentinelOracleNetwork: [ownerAddress],
    SentinelMultiSigVault: [ownerAddress],
    AetheronBridge: [ownerAddress],
    RateLimiter: [ownerAddress],
    CircuitBreaker: [ownerAddress],
    SentinelInterceptor: [80, 1000000000000000000000n, true, ownerAddress],
    SentinelStaking: [mockAddress, mockAddress, ownerAddress],
    SentinelTimelock: [3600, [ownerAddress], [ownerAddress], ownerAddress],
    SentinelGovernance: [mockAddress, mockAddress],
  };

  for (const contractName of contracts) {
    try {
      const ContractFactory = await ethers.getContractFactory(contractName);
      const args = contractArgs[contractName] || [];
      const deploymentTx = await ContractFactory.getDeployTransaction(...args);

      if (deploymentTx) {
        const estimatedGas = await ethers.provider.estimateGas(deploymentTx);
        const feeData = await ethers.provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? 20000000000n; // fallback to 20 gwei
        const estimatedCost = estimatedGas * gasPrice;

        console.log(`${contractName}:`);
        console.log(`  Estimated deployment gas: ${estimatedGas.toString()}`);
        console.log(`  Estimated cost (ETH): ${ethers.formatEther(estimatedCost)}`);
        console.log(
          `  Estimated cost (USD): $${(parseFloat(ethers.formatEther(estimatedCost)) * 3000).toFixed(2)} @ $3000/ETH\n`
        );
      }
    } catch (error) {
      console.log(`${contractName}: Error estimating gas - ${error.message}\n`);
    }
  }

  console.log('📊 Gas Analysis Complete');
  console.log(
    'Note: Actual gas costs may vary based on network conditions and constructor parameters'
  );
}

import { fileURLToPath } from 'url';
import path from 'path';

analyzeGasUsage()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

export { analyzeGasUsage };
