let hre;
let ethers;
require('dotenv').config();

function parseAddressList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseUint(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return BigInt(value);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === 'true' || value === '1';
}

function parseChainLimits(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      const [chainId, limit] = entry.split(':').map((part) => part.trim());
      if (!chainId || !limit) throw new Error(`Invalid CHAIN_LIMITS entry: ${entry}`);
      return { chainId: BigInt(chainId), limit: ethers.parseEther(limit) };
    });
}

function requireAddress(name, value) {
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${name} must be a valid address. Received: ${value || '<empty>'}`);
  }
}

function requireAddressList(name, values, required = false) {
  if (required && values.length === 0) {
    throw new Error(`${name} must contain at least one address`);
  }
  for (const value of values) requireAddress(name, value);
}

async function main() {
  const hardhatModule = await import('hardhat');
  hre = hardhatModule.default ?? hardhatModule;
  const connection = await hre.network.getOrCreate();
  ethers = connection.ethers;

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const provider = deployer.provider;
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId !== 1) {
    throw new Error(`Refusing mainnet preflight on chainId ${chainId}. Expected Ethereum mainnet chainId 1.`);
  }

  const owner = process.env.SENTINEL_OWNER || deployerAddress;

  const config = {
    owner,
    anomalyThreshold: Number(process.env.ANOMALY_THRESHOLD || '10'),
    tvlThreshold: ethers.parseEther(process.env.TVL_THRESHOLD_ETH || '1000'),
    autonomousMode: parseBoolean(process.env.AUTONOMOUS_MODE, true),
    rewardPerSecond: parseUint(process.env.REWARD_PER_SECOND, 0n),
    relayers: parseAddressList(process.env.RELAYER_ADDRESSES),
    callers: parseAddressList(process.env.CALLER_ADDRESSES),
    monitors: parseAddressList(process.env.MONITOR_ADDRESSES),
    reporters: parseAddressList(process.env.REPORTER_ADDRESSES),
    trackedChains: parseAddressList(process.env.TRACKED_CHAIN_IDS).map((id) => BigInt(id)),
    bridgeTokens: parseAddressList(process.env.BRIDGE_TOKEN_ADDRESSES),
    chainLimits: parseChainLimits(process.env.CHAIN_LIMITS),
    lpToken: process.env.LP_TOKEN_ADDRESS || '',
    stakingToken: process.env.STAKING_TOKEN_ADDRESS || '',
    rewardToken: process.env.REWARD_TOKEN_ADDRESS || '',
    yieldToken: process.env.YIELD_TOKEN_ADDRESS || '',
    grantSecurityReporters: parseAddressList(process.env.SECURITY_REPORTER_ADDRESSES),
    timelockMinDelay: parseUint(process.env.TIMELOCK_MIN_DELAY, 172800n),
    timelockProposers: parseAddressList(process.env.TIMELOCK_PROPOSERS),
    timelockExecutors: parseAddressList(process.env.TIMELOCK_EXECUTORS),
    timelockAdmin: process.env.TIMELOCK_ADMIN || owner,
  };

  requireAddress('SENTINEL_OWNER', config.owner);
  requireAddress('TIMELOCK_ADMIN', config.timelockAdmin);
  requireAddressList('RELAYER_ADDRESSES', config.relayers, true);
  requireAddressList('CALLER_ADDRESSES', config.callers);
  requireAddressList('MONITOR_ADDRESSES', config.monitors);
  requireAddressList('REPORTER_ADDRESSES', config.reporters);
  requireAddressList('BRIDGE_TOKEN_ADDRESSES', config.bridgeTokens);
  requireAddressList('SECURITY_REPORTER_ADDRESSES', config.grantSecurityReporters);
  requireAddressList('TIMELOCK_PROPOSERS', config.timelockProposers);
  requireAddressList('TIMELOCK_EXECUTORS', config.timelockExecutors.filter((addr) => addr !== ethers.ZeroAddress));

  for (const maybeAddress of ['lpToken', 'stakingToken', 'rewardToken', 'yieldToken']) {
    const value = config[maybeAddress];
    if (value) requireAddress(maybeAddress.toUpperCase(), value);
  }

  if (!Number.isFinite(config.anomalyThreshold) || config.anomalyThreshold < 0) {
    throw new Error('ANOMALY_THRESHOLD must be a non-negative number');
  }

  const balance = await provider.getBalance(deployerAddress);
  const feeData = await provider.getFeeData();
  const blockNumber = await provider.getBlockNumber();

  console.log('MAINNET PREFLIGHT: PASS');
  console.log('Network chainId:', chainId);
  console.log('Latest block:', blockNumber);
  console.log('Deployer:', deployerAddress);
  console.log('Owner:', config.owner);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');
  console.log('Relayers:', config.relayers.join(', '));
  console.log('Tracked chains:', config.trackedChains.map(String).join(', ') || '<none>');
  console.log('Bridge tokens:', config.bridgeTokens.join(', ') || '<none>');
  console.log('Chain limits:', config.chainLimits.map((item) => `${item.chainId}:${item.limit}`).join(', ') || '<none>');
  console.log('Timelock min delay:', config.timelockMinDelay.toString());
  console.log('Gas data:', JSON.stringify({
    gasPrice: feeData.gasPrice ? feeData.gasPrice.toString() : null,
    maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas.toString() : null,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : null,
  }, null, 2));
  console.log('\nNo transactions were sent. This command only validates mainnet config, signer, RPC, balance, and address formats.');
}

main().catch((error) => {
  console.error('MAINNET PREFLIGHT: FAIL');
  console.error(error);
  process.exitCode = 1;
});
