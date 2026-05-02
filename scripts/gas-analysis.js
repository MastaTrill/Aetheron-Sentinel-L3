import hardhat from 'hardhat';
const { ethers } = hardhat;

async function analyzeGasUsage() {
  console.log('⛽ Gas Usage Analysis for Aetheron Sentinel L3');
  console.log('============================================\n');

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

  for (const contractName of contracts) {
    try {
      const Contract = await ethers.getContractFactory(contractName);
      const deploymentTx = Contract.getDeployTransaction();

      if (deploymentTx) {
        const estimatedGas = await ethers.provider.estimateGas(deploymentTx);
        const gasPrice = await ethers.provider.getGasPrice();
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

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeGasUsage()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { analyzeGasUsage };
