require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function getNetworkName() {
  const idx = process.argv.indexOf('--network');
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.HARDHAT_NETWORK || 'sepolia';
}

function getRpcUrl(network) {
  const map = {
    sepolia: process.env.SEPOLIA_RPC_URL,
    mainnet: process.env.MAINNET_RPC_URL,
    hoodi: process.env.HOODI_RPC_URL,
    baseSepolia: process.env.BASE_SEPOLIA_RPC_URL,
  };
  const url = map[network];
  if (!url) throw new Error(`No RPC URL configured for network: ${network}`);
  return url;
}

function loadArtifact() {
  const artifactPath = path.join(
    process.cwd(),
    'artifacts',
    'contracts',
    'SentinelCoreLoop.sol',
    'SentinelCoreLoop.json',
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact not found at ${artifactPath}. Run npm run compile first.`,
    );
  }
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

async function main() {
  const network = getNetworkName();
  const provider = new ethers.JsonRpcProvider(getRpcUrl(network));

  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY env var is required.');
  }

  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const owner = process.env.SENTINEL_OWNER || deployer.address;

  const rawAddresses = process.env.DEPLOYED_ADDRESSES;
  if (!rawAddresses) {
    throw new Error(
      'DEPLOYED_ADDRESSES env var is required and must contain JSON contract addresses.',
    );
  }
  const addresses = JSON.parse(rawAddresses);

  const artifact = loadArtifact();
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    deployer,
  );

  console.log(`Redeploying SentinelCoreLoop on ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Owner: ${owner}`);

  const coreLoop = await factory.deploy(owner);
  await coreLoop.waitForDeployment();

  const deployedAddress = await coreLoop.getAddress();
  const deployTx = coreLoop.deploymentTransaction();
  const receipt = deployTx ? await deployTx.wait() : null;

  console.log(`New SentinelCoreLoop: ${deployedAddress}`);
  if (receipt?.blockNumber != null) {
    console.log(`Deployment block: ${receipt.blockNumber}`);
  }

  if (typeof coreLoop.initializeCoreComponents === 'function') {
    console.log(
      'Bootstrapping CoreLoop components via initializeCoreComponents...',
    );
    const tx = await coreLoop.initializeCoreComponents(
      addresses.SentinelInterceptor || ethers.ZeroAddress,
      addresses.AetheronBridge || ethers.ZeroAddress,
      addresses.SentinelQuantumGuard || ethers.ZeroAddress,
      addresses.RateLimiter || ethers.ZeroAddress,
      addresses.CircuitBreaker || ethers.ZeroAddress,
      addresses.SentinelYieldMaximizer || ethers.ZeroAddress,
      addresses.SentinelOracleNetwork || ethers.ZeroAddress,
    );
    await tx.wait();
    console.log('CoreLoop bootstrap complete.');
  }

  const merged = {
    ...addresses,
    SentinelCoreLoop: deployedAddress,
  };

  console.log('\nUpdated DEPLOYED_ADDRESSES JSON:');
  console.log(JSON.stringify(merged));

  console.log('\nNext steps:');
  console.log('1) Export this JSON into DEPLOYED_ADDRESSES');
  console.log('2) Run: npm run setup:ownership -- --network ' + network);
  console.log(
    "3) Run: DEPLOYED_ADDRESSES='" +
      JSON.stringify(merged) +
      "' npm run verify:" +
      (network === 'mainnet'
        ? 'mainnet'
        : network === 'sepolia'
          ? 'testnet'
          : network),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
