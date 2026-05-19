import { ethers } from 'hardhat';
import { loadManifest, saveManifest, DeploymentRecord } from './manifest';
import 'dotenv/config';

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  if (network.chainId !== 8453n) {
    throw new Error(`Wrong chainId: ${network.chainId.toString()}`);
  }

  const tag = process.env.DEPLOY_TAG;
  if (!tag) throw new Error('DEPLOY_TAG not set');

  // Harden: require OWNER_ADDRESS and AUDITOR_ADDRESS
  const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
  if (!OWNER_ADDRESS || !ethers.isAddress(OWNER_ADDRESS))
    throw new Error('OWNER_ADDRESS not set or invalid');
  const AUDITOR_ADDRESS = process.env.AUDITOR_ADDRESS;
  if (!AUDITOR_ADDRESS || !ethers.isAddress(AUDITOR_ADDRESS))
    throw new Error('AUDITOR_ADDRESS not set or invalid');

  console.log(
    `Deploying Sentinel L3 with tag=${tag} from=${deployer.address} (OWNER=${OWNER_ADDRESS})`
  );

  const manifest = loadManifest();
  if (manifest.find(m => m.tag === tag)) {
    throw new Error(`Tag ${tag} already used`);
  }

  // Deploy SentinelCore
  const SentinelCore = await ethers.getContractFactory('SentinelCore');
  const sentinelCore = await SentinelCore.deploy(OWNER_ADDRESS);
  await sentinelCore.waitForDeployment();
  const sentinelCoreAddress = await sentinelCore.getAddress();
  console.log('SentinelCore:', sentinelCoreAddress);

  // Deploy SentinelToken
  const SentinelToken = await ethers.getContractFactory('SentinelToken');
  const sentinelToken = await SentinelToken.deploy(OWNER_ADDRESS);
  await sentinelToken.waitForDeployment();
  const sentinelTokenAddress = await sentinelToken.getAddress();
  console.log('SentinelToken:', sentinelTokenAddress);

  // Deploy SentinelStaking (needs stakingToken, rewardToken, owner)
  const SentinelStaking = await ethers.getContractFactory('SentinelStaking');
  const sentinelStaking = await SentinelStaking.deploy(
    sentinelTokenAddress, // stakingToken
    sentinelTokenAddress, // rewardToken (for demo, use same)
    OWNER_ADDRESS
  );
  await sentinelStaking.waitForDeployment();
  const sentinelStakingAddress = await sentinelStaking.getAddress();
  console.log('SentinelStaking:', sentinelStakingAddress);

  // Deploy SentinelRewardAggregator (needs staking, liquidityMining, governanceToken, referralSystem)
  // For demo, use sentinelStakingAddress for all, or set to zero address if not yet deployed
  const SentinelRewardAggregator = await ethers.getContractFactory('SentinelRewardAggregator');
  const sentinelRewardAggregator = await SentinelRewardAggregator.deploy(
    sentinelStakingAddress,
    ethers.ZeroAddress, // TODO: replace with real liquidityMining address
    sentinelTokenAddress,
    ethers.ZeroAddress // TODO: replace with real referralSystem address
  );
  await sentinelRewardAggregator.waitForDeployment();
  const sentinelRewardAggregatorAddress = await sentinelRewardAggregator.getAddress();
  console.log('SentinelRewardAggregator:', sentinelRewardAggregatorAddress);

  // Deploy SentinelInsuranceProtocol (needs sentinelCore, sentinelAuditor, owner)
  const SentinelInsuranceProtocol = await ethers.getContractFactory('SentinelInsuranceProtocol');
  const sentinelInsuranceProtocol = await SentinelInsuranceProtocol.deploy(
    sentinelCoreAddress,
    AUDITOR_ADDRESS,
    OWNER_ADDRESS
  );
  await sentinelInsuranceProtocol.waitForDeployment();
  const sentinelInsuranceProtocolAddress = await sentinelInsuranceProtocol.getAddress();
  console.log('SentinelInsuranceProtocol:', sentinelInsuranceProtocolAddress);

  // Deploy SentinelAMM (owner)
  const SentinelAMM = await ethers.getContractFactory('SentinelAMM');
  const sentinelAMM = await SentinelAMM.deploy(OWNER_ADDRESS);
  await sentinelAMM.waitForDeployment();
  const sentinelAMMAddress = await sentinelAMM.getAddress();
  console.log('SentinelAMM:', sentinelAMMAddress);

  // Deploy AetheronBridge (owner)
  const AetheronBridge = await ethers.getContractFactory('AetheronBridge');
  const aetheronBridge = await AetheronBridge.deploy(OWNER_ADDRESS);
  await aetheronBridge.waitForDeployment();
  const aetheronBridgeAddress = await aetheronBridge.getAddress();
  console.log('AetheronBridge:', aetheronBridgeAddress);

  // Add more deployments as needed, wiring constructor params as required

  const record: DeploymentRecord = {
    tag,
    network: 'base',
    chainId: Number(network.chainId),
    timestamp: Math.floor(Date.now() / 1000),
    contracts: {
      SentinelCore: sentinelCoreAddress,
      SentinelToken: sentinelTokenAddress,
      SentinelStaking: sentinelStakingAddress,
      SentinelRewardAggregator: sentinelRewardAggregatorAddress,
      SentinelInsuranceProtocol: sentinelInsuranceProtocolAddress,
      SentinelAMM: sentinelAMMAddress,
      AetheronBridge: aetheronBridgeAddress,
      // Add more contract addresses here
    },
  };

  manifest.push(record);
  saveManifest(manifest);

  console.log('Deployment complete. Manifest updated.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
