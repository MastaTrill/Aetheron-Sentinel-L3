import hardhat from 'hardhat';
const { ethers } = hardhat;

async function verifyDeployment() {
  console.log('🔍 Deployment Verification for Aetheron Sentinel L3');
  console.log('=================================================\n');

  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})\n`);

  // Check if contracts are deployed by trying to get their addresses
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
    'SentinelInterceptor'
  ];

  let deployedCount = 0;
  let totalCount = contracts.length;

  for (const contractName of contracts) {
    try {
      const Contract = await ethers.getContractFactory(contractName);
      const contract = await Contract.deploy();
      await contract.waitForDeployment();

      const address = await contract.getAddress();
      console.log(`✅ ${contractName}: ${address}`);

      deployedCount++;
    } catch (error) {
      console.log(`❌ ${contractName}: Deployment failed - ${error.message}`);
    }
  }

  console.log(`\n📊 Deployment Summary:`);
  console.log(`   Deployed: ${deployedCount}/${totalCount} contracts`);
  console.log(`   Success Rate: ${((deployedCount/totalCount) * 100).toFixed(1)}%`);

  if (deployedCount === totalCount) {
    console.log('🎉 All contracts deployed successfully!');
  } else {
    console.log('⚠️ Some contracts failed to deploy. Check the errors above.');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyDeployment()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Deployment verification failed:', error);
      process.exit(1);
    });
}

export { verifyDeployment };