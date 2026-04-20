/**
 * Etherscan verification script for Sentinel L3 contracts.
 *
 * Usage:
 *   DEPLOYED_ADDRESSES='{"SentinelToken":"0x...","AetheronBridge":"0x..."}' \
 *   SENTINEL_OWNER=0xYourOwner \
 *   ANOMALY_THRESHOLD=10 \
 *   TVL_THRESHOLD_ETH=1000 \
 *   AUTONOMOUS_MODE=true \
 *   STAKING_TOKEN_ADDRESS=0x... \
 *   REWARD_TOKEN_ADDRESS=0x... \
 *   npx hardhat run scripts/verify.js --network sepolia
 *
 * All env vars default to the same values used in deploy.js.
 * Set DEPLOYED_ADDRESSES as a JSON string of { ContractName: address }.
 */

const hre = require('hardhat');
require('dotenv').config();

function parseAddressList(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === 'true' || value === '1';
}

async function verify(address, constructorArguments) {
  try {
    await hre.run('verify:verify', { address, constructorArguments });
    console.log(`  ✅ Verified: ${address}`);
  } catch (err) {
    if (err.message && err.message.includes('Already Verified')) {
      console.log(`  ℹ️  Already verified: ${address}`);
    } else {
      console.warn(`  ⚠️  Verification failed for ${address}: ${err.message}`);
    }
  }
}

async function main() {
  const rawAddresses = process.env.DEPLOYED_ADDRESSES;
  if (!rawAddresses) {
    throw new Error(
      'DEPLOYED_ADDRESSES env var is required.\n' +
        'Set it to the JSON output printed by deploy.js, e.g.:\n' +
        '  DEPLOYED_ADDRESSES=\'{"SentinelToken":"0x..."}\' npx hardhat run scripts/verify.js --network sepolia',
    );
  }

  const addresses = JSON.parse(rawAddresses);

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const owner = process.env.SENTINEL_OWNER || deployerAddress;

  const anomalyThreshold = Number(process.env.ANOMALY_THRESHOLD || '10');
  const tvlThreshold = hre.ethers.parseEther(
    process.env.TVL_THRESHOLD_ETH || '1000',
  );
  const autonomousMode = parseBoolean(process.env.AUTONOMOUS_MODE, true);

  const stakingTokenAddress =
    process.env.STAKING_TOKEN_ADDRESS || addresses.SentinelToken || '';
  const rewardTokenAddress =
    process.env.REWARD_TOKEN_ADDRESS || addresses.SentinelToken || '';
  const yieldTokenAddress =
    process.env.YIELD_TOKEN_ADDRESS || addresses.SentinelToken || '';
  const lpTokenAddress = process.env.LP_TOKEN_ADDRESS || '';
  const rewardPerSecond = BigInt(process.env.REWARD_PER_SECOND || '0');

  const securityAuditorAddress = addresses.SentinelSecurityAuditor || '';
  const sentinelCoreAddress = addresses.SentinelCoreLoop || '';

  console.log(`Verifying contracts on network: ${hre.network.name}`);
  console.log(`Owner: ${owner}\n`);

  const tasks = [
    {
      name: 'SentinelToken',
      args: [owner],
    },
    {
      name: 'AetheronBridge',
      args: [owner],
    },
    {
      name: 'SentinelInterceptor',
      args: [anomalyThreshold, tvlThreshold, autonomousMode, owner],
    },
    {
      name: 'CircuitBreaker',
      args: [owner],
    },
    {
      name: 'RateLimiter',
      args: [owner],
    },
    {
      name: 'SentinelQuantumGuard',
      args: [owner],
    },
    {
      name: 'SentinelMultiSigVault',
      args: [owner],
    },
    {
      name: 'SentinelOracleNetwork',
      args: [owner],
    },
    {
      name: 'SentinelSecurityAuditor',
      args: [owner],
    },
    {
      name: 'SentinelMonitor',
      args: [owner],
    },
    {
      name: 'SentinelYieldMaximizer',
      args: [owner],
    },
    {
      name: 'SentinelStaking',
      args: [stakingTokenAddress, rewardTokenAddress, owner],
    },
    {
      name: 'SentinelReferralSystem',
      args: [rewardTokenAddress, owner],
    },
    ...(lpTokenAddress
      ? [
          {
            name: 'SentinelLiquidityMining',
            args: [lpTokenAddress, rewardTokenAddress, rewardPerSecond, owner],
          },
        ]
      : []),
    ...(sentinelCoreAddress && securityAuditorAddress
      ? [
          {
            name: 'SentinelInsuranceProtocol',
            args: [sentinelCoreAddress, securityAuditorAddress, owner],
          },
        ]
      : []),
    {
      name: 'SentinelQuantumKeyDistribution',
      args: [owner],
    },
    {
      name: 'SentinelQuantumNeural',
      args: [owner],
    },
    {
      name: 'SentinelZKIdentity',
      args: [owner],
    },
    ...(addresses.SentinelZKIdentity
      ? [
          {
            name: 'SentinelSocialRecovery',
            args: [addresses.SentinelZKIdentity, owner],
          },
        ]
      : []),
    {
      name: 'SentinelCoreLoop',
      args: [owner],
    },
    {
      name: 'SentinelAMM',
      args: [owner],
    },
    {
      name: 'SentinelPredictiveThreatModel',
      args: [owner],
    },
    {
      name: 'SentinelHomomorphicEncryption',
      args: [owner],
    },
    {
      name: 'SentinelZKOracle',
      args: [owner],
    },
    ...(addresses.SentinelTimelock
      ? [
          {
            name: 'SentinelTimelock',
            args: [
              BigInt(process.env.TIMELOCK_MIN_DELAY || '172800'),
              parseAddressList(process.env.TIMELOCK_PROPOSERS).length
                ? parseAddressList(process.env.TIMELOCK_PROPOSERS)
                : [deployerAddress],
              parseAddressList(process.env.TIMELOCK_EXECUTORS).length
                ? parseAddressList(process.env.TIMELOCK_EXECUTORS)
                : [hre.ethers.ZeroAddress],
              process.env.TIMELOCK_ADMIN || owner,
            ],
          },
        ]
      : []),
    ...(addresses.SentinelGovernance && addresses.SentinelTimelock
      ? [
          {
            name: 'SentinelGovernance',
            args: [addresses.SentinelToken, addresses.SentinelTimelock],
          },
        ]
      : []),
  ];

  for (const { name, args } of tasks) {
    const address = addresses[name];
    if (!address) {
      console.log(`Skipping ${name}: no address in DEPLOYED_ADDRESSES`);
      continue;
    }
    console.log(`Verifying ${name} at ${address}...`);
    await verify(address, args);
  }

  console.log('\nVerification run complete.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
