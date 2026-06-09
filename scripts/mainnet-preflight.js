const ethers = require('ethers');
const shellOwnerKey = process.env.OWNER_PRIVATE_KEY;
require('dotenv').config();
require('dotenv').config({ path: '.env.mainnet', override: true });
if (shellOwnerKey !== undefined) process.env.OWNER_PRIVATE_KEY = shellOwnerKey;
else delete process.env.OWNER_PRIVATE_KEY;

function parseAddressList(value) {
  return (value || '').split(',').map(s => s.trim()).filter(Boolean);
}
function parseUint(v, fb) { return (v === undefined || v === null || v === '') ? fb : BigInt(v); }
function parseBool(v, fb) { return (v === undefined || v === null || v === '') ? fb : v === 'true' || v === '1'; }
function parseChainLimits(value) {
  return (value || '').split(',').map(s => s.trim()).filter(Boolean).map(e => {
    const [id, lim] = e.split(':').map(s => s.trim());
    if (!id || !lim) throw new Error(`Invalid CHAIN_LIMITS: ${e}`);
    return { chainId: BigInt(id), limit: ethers.parseEther(lim) };
  });
}
function reqAddr(name, val) { if (!val || !ethers.isAddress(val)) throw new Error(name + ' must be valid. Got: ' + (val || '<empty>')); }
function reqAddrList(name, vals, req = false) {
  if (req && vals.length === 0) throw new Error(`${name} needs at least one address`);
  vals.forEach(v => reqAddr(name, v));
}

async function main() {
  const rpcUrl = (process.env.MAINNET_RPC_URL || '').trim();
  if (!rpcUrl) throw new Error('MAINNET_RPC_URL missing');
  if (rpcUrl.includes('YOUR_') || rpcUrl.endsWith('/v3/')) throw new Error('MAINNET_RPC_URL is a placeholder');

  const pk = (process.env.OWNER_PRIVATE_KEY || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error('OWNER_PRIVATE_KEY must be 0x + 64 hex chars (set in shell)');

  // Create provider — use chainId 1 directly to skip network detection
  const provider = new ethers.JsonRpcProvider(rpcUrl, { name: 'mainnet', chainId: 1 });

  // Verify RPC is reachable with a simple call
  let blockNumber;
  try {
    blockNumber = await provider.getBlockNumber();
  } catch (e) {
    throw new Error(`Cannot reach MAINNET_RPC_URL: ${e.message}`);
  }

  const deployer = new ethers.Wallet(pk, provider);
  const deployerAddress = await deployer.getAddress();
  const balance = await provider.getBalance(deployerAddress);
  const feeData = await provider.getFeeData();

  const owner = process.env.SENTINEL_OWNER || deployerAddress;
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
  reqAddrList('TIMELOCK_EXECUTORS', config.timelockExecutors.filter(a => a !== ethers.ZeroAddress));
  ['lpToken','stakingToken','rewardToken','yieldToken'].forEach(k => { if (config[k]) reqAddr(k.toUpperCase(), config[k]); });

  console.log('MAINNET PREFLIGHT: PASS');
  console.log('Latest block:', blockNumber);
  console.log('Deployer:', deployerAddress);
  console.log('Owner:', config.owner);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
  console.log('Relayers:', config.relayers.join(', '));
  console.log('Gas:', JSON.stringify({ gasPrice: feeData.gasPrice?.toString(), maxFeePerGas: feeData.maxFeePerGas?.toString() }));
  console.log('\nNo transactions sent. All config valid.');
}

main().catch(e => { console.error('MAINNET PREFLIGHT: FAIL'); console.error(e.message); process.exitCode = 1; });
