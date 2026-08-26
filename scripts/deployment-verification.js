import hardhat from 'hardhat';
const { ethers } = hardhat;

async function verifyDeployment() {
  console.log('🔍 Deployment Verification for Aetheron Sentinel L3');
  console.log('=================================================\n');

  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})\n`);

  // --- IMPORTANT ---
  // For actual verification, these addresses should come from a reliable source
  // (e.g., a .env file updated by deploy.js, or a deployment JSON record).
  // For this example, we'll use placeholder environment variables.
  const deployedAddresses = {
    SentinelCore: process.env.SENTINEL_CORE_ADDRESS,
    SentinelToken: process.env.SENTINEL_TOKEN_ADDRESS,
    SentinelStaking: process.env.SENTINEL_STAKING_ADDRESS,
    SentinelAMM: process.env.SENTINEL_AMM_ADDRESS,
    SentinelOracleNetwork: process.env.SENTINEL_ORACLE_NETWORK_ADDRESS,
    SentinelMultiSigVault: process.env.SENTINEL_MULTISIG_VAULT_ADDRESS,
    SentinelTimelock: process.env.SENTINEL_TIMELOCK_ADDRESS,
    SentinelGovernance: process.env.SENTINEL_GOVERNANCE_ADDRESS,
    AetheronBridge: process.env.AETHERON_BRIDGE_ADDRESS,
    RateLimiter: process.env.RATE_LIMITER_ADDRESS,
    CircuitBreaker: process.env.CIRCUIT_BREAKER_ADDRESS,
    SentinelInterceptor: process.env.INTERCEPTOR_ADDRESS, // This one is explicitly set by deploy.js
    SentinelMonitor: process.env.MONITOR_ADDRESS, // This one is explicitly set by deploy.js
  };

  const contractsToVerify = Object.entries(deployedAddresses).filter(([, address]) => address);

  let deployedCount = 0;
  let totalCount = contractsToVerify.length;

  if (totalCount === 0) {
    console.log('⚠️ No contract addresses found in environment variables for verification.');
    console.log(
      'Please ensure your .env file is correctly populated with deployed contract addresses.'
    );
    return;
  }

  for (const [contractName, address] of contractsToVerify) {
    try {
      const code = await ethers.provider.getCode(address);
      if (code && code !== '0x' && code !== '0x0') {
        console.log(`✅ ${contractName} (${address}): Code found on chain.`);
        deployedCount++;
      } else {
        console.log(`❌ ${contractName} (${address}): No code found on chain.`);
      }

      deployedCount++;
    } catch (error) {
      console.log(`❌ ${contractName}: Deployment failed - ${error.message}`);
    }
  }

  console.log(`\n📊 Deployment Summary:`);
  console.log(`   Deployed: ${deployedCount}/${totalCount} contracts`);
  console.log(`   Success Rate: ${((deployedCount / totalCount) * 100).toFixed(1)}%`);

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
    .catch(error => {
      console.error('Deployment verification failed:', error);
      process.exit(1);
    });
}

export { verifyDeployment };
