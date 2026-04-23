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

require('dotenv').config();
const { ethers } = require('ethers');
const path = require('path');
const fsSync = require('fs');
const fs = require('fs/promises');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

function getCliNetworkName() {
  const envNetwork =
    process.env.HARDHAT_NETWORK || process.env.npm_config_network;
  if (envNetwork) return envNetwork;

  const networkIndex = process.argv.indexOf('--network');
  if (networkIndex >= 0 && process.argv[networkIndex + 1]) {
    return process.argv[networkIndex + 1];
  }

  return 'sepolia';
}

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

function getVerifyCliConfig() {
  const verifyToolsDir = path.join(process.cwd(), 'tools', 'verify');
  const verifyConfigPath = path.join(verifyToolsDir, 'hardhat.config.cjs');
  const hardhatCmd = path.join(
    verifyToolsDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'hardhat.cmd' : 'hardhat',
  );

  if (!fsSync.existsSync(hardhatCmd) || !fsSync.existsSync(verifyConfigPath)) {
    throw new Error(
      'Verification tooling is not installed. Run: npm run setup:verify-tooling',
    );
  }

  return { hardhatCmd, verifyConfigPath };
}

async function verify(address, constructorArguments) {
  const networkName = getCliNetworkName();
  const { hardhatCmd, verifyConfigPath } = getVerifyCliConfig();
  const argsFilePath = path.join(
    process.cwd(),
    '.verify-args',
    `${address.toLowerCase()}.cjs`,
  );

  // Hardhat verify accepts constructor args from a JS module path.
  const encodedArgs = JSON.stringify(constructorArguments, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

  try {
    await fs.mkdir(path.dirname(argsFilePath), { recursive: true });
    await fs.writeFile(
      argsFilePath,
      `module.exports = ${encodedArgs};\n`,
      'utf8',
    );

    const cliArgs = [
      'verify',
      '--config',
      verifyConfigPath,
      '--network',
      networkName,
      '--constructor-args-path',
      argsFilePath,
      address,
    ];

    if (process.platform === 'win32') {
      const command = `"${hardhatCmd}" ${cliArgs.map((arg) => `"${arg}"`).join(' ')}`;
      await execAsync(command, {
        cwd: process.cwd(),
        env: process.env,
      });
    } else {
      await execFileAsync(hardhatCmd, cliArgs, {
        cwd: process.cwd(),
        env: process.env,
      });
    }

    console.log(`  ✅ Verified: ${address}`);
  } catch (err) {
    const output = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`;
    if (/already verified/i.test(output)) {
      console.log(`  ℹ️  Already verified: ${address}`);
    } else {
      const reason =
        (err.stderr && err.stderr.trim()) ||
        (err.stdout && err.stdout.trim()) ||
        err.message;
      console.warn(`  ⚠️  Verification failed for ${address}: ${reason}`);
    }
  } finally {
    await fs.rm(argsFilePath, { force: true }).catch(() => {});
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

  const deployerAddress = process.env.PRIVATE_KEY
    ? new ethers.Wallet(process.env.PRIVATE_KEY).address
    : ethers.ZeroAddress;
  const owner = process.env.SENTINEL_OWNER || deployerAddress;

  const anomalyThreshold = Number(process.env.ANOMALY_THRESHOLD || '10');
  const tvlThreshold = ethers.parseEther(
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

  console.log(`Verifying contracts on network: ${getCliNetworkName()}`);
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
      name: 'SentinelCore',
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
                : [ethers.ZeroAddress],
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
