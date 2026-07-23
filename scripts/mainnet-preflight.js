import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();
dotenv.config({ path: '.env.mainnet', override: true });
const shellOwnerKey = process.env.OWNER_PRIVATE_KEY;
if (shellOwnerKey !== undefined) process.env.OWNER_PRIVATE_KEY = shellOwnerKey;
else delete process.env.OWNER_PRIVATE_KEY;

function parseAddressList(value) {
  return (value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}
function parseUint(v, fb) {
  return v === undefined || v === null || v === '' ? fb : BigInt(v);
}
function parseBool(v, fb) {
  return v === undefined || v === null || v === '' ? fb : v === 'true' || v === '1';
}
function parseChainLimits(value) {
  return (value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(e => {
      const [id, lim] = e.split(':').map(s => s.trim());
      if (!id || !lim) throw new Error(`Invalid CHAIN_LIMITS: ${e}`);
      return { chainId: BigInt(id), limit: ethers.parseEther(lim) };
    });
}
function reqAddr(name, val) {
  if (!val || !ethers.isAddress(val))
    throw new Error(name + ' must be valid. Got: ' + (val || '<empty>'));
}
function reqAddrList(name, vals, req = false) {
  if (req && vals.length === 0) throw new Error(`${name} needs at least one address`);
  vals.forEach(v => reqAddr(name, v));
}

const NETWORKS = {
  mainnet: { rpcEnv: 'MAINNET_RPC_URL', chainId: 1, name: 'mainnet', currency: 'ETH' },
  base: { rpcEnv: 'BASE_MAINNET_RPC_URL', chainId: 8453, name: 'base', currency: 'ETH' },
  'base-sepolia': {
    rpcEnv: 'BASE_TESTNET_RPC_URL',
    chainId: 84532,
    name: 'base-sepolia',
    currency: 'ETH',
  },
};

async function main() {
  const networkArgIndex = process.argv.indexOf('--network');
  const networkKey = (
    (networkArgIndex >= 0 ? process.argv[networkArgIndex + 1] : undefined) ||
    process.env.DEPLOY_NETWORK ||
    'base'
  ).trim().toLowerCase();
  const network = NETWORKS[networkKey];
  if (!network) throw new Error(`Unsupported DEPLOY_NETWORK: ${networkKey}`);

  const rpcUrl = (process.env[network.rpcEnv] || '').trim().replace(/^["']|["']$/g, '');
  if (!rpcUrl) throw new Error(`${network.rpcEnv} missing`);
  if (rpcUrl.includes('YOUR_') || rpcUrl.endsWith('/v3/'))
    throw new Error(`${network.rpcEnv} is a placeholder`);

  const pk = (process.env.OWNER_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk))
    throw new Error('OWNER_PRIVATE_KEY must be 0x + 64 hex chars (set in shell)');

  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    name: network.name,
    chainId: network.chainId,
  });
  let blockNumber;
  try {
    const actualNetwork = await provider.getNetwork();
    if (Number(actualNetwork.chainId) !== network.chainId) {
      throw new Error(
        `RPC chain ID ${actualNetwork.chainId} does not match expected ${network.chainId}`
      );
    }
    blockNumber = await provider.getBlockNumber();
  } catch (e) {
    throw new Error(`Cannot validate ${network.rpcEnv}: ${e.message}`);
  }

  const deployer = new ethers.Wallet(pk, provider);
  const deployerAddress = await deployer.getAddress();
  const balance = await provider.getBalance(deployerAddress);
  const feeData = await provider.getFeeData();

  const owner = process.env.SENTINEL_OWNER || process.env.OWNER_ADDRESS || deployerAddress;
  const config = {
    owner,
    anomalyThreshold: Number(process.env.ANOMALY_THRESHOLD || '10'),
    tvlThreshold: ethers.parseEther(process.env.TVL_THRESHOLD_ETH || '1000'),
    autonomousMode: parseBool(process.env.AUTONOMOUS_MODE, true),
    rewardPerSecond: parseUint(process.env.REWARD_PER_SECOND, 0n),
    relayers: parseAddressList(process.env.RELAYER_ADDRESSES),
    callers: parseAddressList(process.env.CALLER_ADDRESSES),
    monitors: parseAddressList(process.env.MONITOR_ADDRESSES),
    reporters: parseAddressList(process.env.REPORTER_ADDRESSES),
    trackedChains: parseAddressList(process.env.TRACKED_CHAIN_IDS).map(id => BigInt(id)),
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

  reqAddr('SENTINEL_OWNER', config.owner);
  reqAddr('TIMELOCK_ADMIN', config.timelockAdmin);
  reqAddrList('RELAYER_ADDRESSES', config.relayers, true);
  reqAddrList('CALLER_ADDRESSES', config.callers);
  reqAddrList('MONITOR_ADDRESSES', config.monitors);
  reqAddrList('REPORTER_ADDRESSES', config.reporters);
  reqAddrList('BRIDGE_TOKEN_ADDRESSES', config.bridgeTokens);
  reqAddrList('SECURITY_REPORTER_ADDRESSES', config.grantSecurityReporters);
  reqAddrList('TIMELOCK_PROPOSERS', config.timelockProposers);
  reqAddrList(
    'TIMELOCK_EXECUTORS',
    config.timelockExecutors.filter(a => a !== ethers.ZeroAddress)
  );
  ['lpToken', 'stakingToken', 'rewardToken', 'yieldToken'].forEach(k => {
    if (config[k]) reqAddr(k.toUpperCase(), config[k]);
  });

  if (balance === 0n)
    throw new Error(`Deployer ${deployerAddress} has zero ${network.currency} on ${network.name}`);

  console.log('DEPLOYMENT PREFLIGHT: PASS');
  console.log('Network:', network.name, `(chainId ${network.chainId})`);
  console.log('Latest block:', blockNumber);
  console.log('Deployer:', deployerAddress);
  console.log('Owner:', config.owner);
  console.log('Balance:', ethers.formatEther(balance), network.currency);
  console.log('Relayers:', config.relayers.join(', '));
  console.log(
    'Gas:',
    JSON.stringify({
      gasPrice: feeData.gasPrice?.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
    })
  );
  console.log('\nNo transactions sent. All config valid.');
}

main().catch(e => {
  console.error('DEPLOYMENT PREFLIGHT: FAIL');
  console.error(e.message);
  process.exitCode = 1;
});
