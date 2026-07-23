import dotenv from 'dotenv';
import { ethers } from 'ethers';
import releaseModule from './lib/release-core.cjs';

const {
  PUBLIC_NETWORKS,
  RELEASE_CONFIG,
  normalizePrivateKey,
  parseAddressList,
  validateGovernanceOwner,
} = releaseModule;

// Local files may fill missing values, but never override shell/CI secrets.
dotenv.config();
dotenv.config({ path: '.env.mainnet' });

const NETWORKS = {
  base: {
    rpcEnv: 'BASE_MAINNET_RPC_URL',
    chainId: 8453,
    name: 'base',
    minBalanceKey: 'baseMinDeployerBalanceEth',
  },
  'base-sepolia': {
    rpcEnv: 'BASE_TESTNET_RPC_URL',
    chainId: 84532,
    name: 'base-sepolia',
    minBalanceKey: 'baseSepoliaMinDeployerBalanceEth',
  },
};

function requireAddress(name, value) {
  if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be a non-zero address`);
  }
}

async function main() {
  const networkKey = String(process.env.DEPLOY_NETWORK || 'base')
    .trim()
    .toLowerCase();
  const selected = NETWORKS[networkKey];
  if (!selected) throw new Error(`Unsupported DEPLOY_NETWORK: ${networkKey}`);

  if (process.env.RELEASE_PROFILE && process.env.RELEASE_PROFILE !== RELEASE_CONFIG.profile) {
    throw new Error(`RELEASE_PROFILE must equal ${RELEASE_CONFIG.profile}`);
  }

  const rpcUrl = String(process.env[selected.rpcEnv] || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!rpcUrl) throw new Error(`${selected.rpcEnv} is missing`);
  if (rpcUrl.includes('YOUR_') || rpcUrl.endsWith('/v3/')) {
    throw new Error(`${selected.rpcEnv} is a placeholder`);
  }

  const privateKey = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('DEPLOYER_PRIVATE_KEY must be 0x followed by 64 hexadecimal characters');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    name: selected.name,
    chainId: selected.chainId,
  });
  const actualNetwork = await provider.getNetwork();
  if (Number(actualNetwork.chainId) !== selected.chainId) {
    throw new Error(
      `RPC chain ID ${actualNetwork.chainId} does not match expected ${selected.chainId}`
    );
  }

  const deployer = new ethers.Wallet(privateKey, provider);
  const deployerAddress = await deployer.getAddress();
  const owner = process.env.SENTINEL_OWNER || process.env.OWNER_ADDRESS;
  requireAddress('SENTINEL_OWNER', owner);
  if (owner.toLowerCase() === deployerAddress.toLowerCase()) {
    throw new Error('SENTINEL_OWNER must differ from the ephemeral deployer');
  }

  const monitors = parseAddressList(process.env.MONITOR_ADDRESSES);
  if (monitors.length === 0) throw new Error('MONITOR_ADDRESSES needs at least one address');
  for (const monitor of monitors) {
    requireAddress('MONITOR_ADDRESSES', monitor);
    if (monitor.toLowerCase() === deployerAddress.toLowerCase()) {
      throw new Error('The ephemeral deployer cannot remain a monitor');
    }
  }

  const balance = await provider.getBalance(deployerAddress);
  const minimumBalanceText =
    process.env.MIN_DEPLOYER_BALANCE_ETH || RELEASE_CONFIG.defaults[selected.minBalanceKey];
  const minimumBalance = ethers.parseEther(minimumBalanceText);
  if (balance < minimumBalance) {
    throw new Error(
      `Deployer ${deployerAddress} has ${ethers.formatEther(balance)} ETH; at least ${minimumBalanceText} ETH is required`
    );
  }

  let ownerGovernance = null;
  if (selected.chainId === 8453) {
    ownerGovernance = await validateGovernanceOwner(provider, owner, ethers);
    if (!/^[0-9a-fA-F]{64}$/.test(process.env.AUDIT_REPORT_SHA256 || '')) {
      throw new Error('AUDIT_REPORT_SHA256 must identify the independent audit report');
    }
    if (!/^[0-9a-fA-F]{40}$/.test(process.env.RELEASE_COMMIT || '')) {
      throw new Error('RELEASE_COMMIT must identify the reviewed 40-character Git commit');
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(process.env.RELEASE_TAG || '')) {
      throw new Error('RELEASE_TAG must be an immutable audited release tag');
    }
    if (!/^[1-9][0-9]{0,19}$/.test(process.env.BASE_SEPOLIA_RUN_ID || '')) {
      throw new Error('BASE_SEPOLIA_RUN_ID must identify the successful rehearsal run');
    }
    if (!/^[0-9a-fA-F]{64}$/.test(process.env.BASE_SEPOLIA_MANIFEST_SHA256 || '')) {
      throw new Error('BASE_SEPOLIA_MANIFEST_SHA256 must identify the verified rehearsal manifest');
    }
  }

  const publicNetwork = PUBLIC_NETWORKS[selected.chainId];
  const feeData = await provider.getFeeData();
  const blockNumber = await provider.getBlockNumber();
  console.log('DEPLOYMENT PREFLIGHT: PASS');
  console.log(`Release profile: ${RELEASE_CONFIG.profile}`);
  console.log(`Network: ${publicNetwork.name} (chainId ${selected.chainId})`);
  console.log(`Latest block: ${blockNumber}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Final owner: ${owner}`);
  if (ownerGovernance) {
    console.log(`Governance owner: ${JSON.stringify(ownerGovernance)}`);
  }
  console.log(`Balance: ${ethers.formatEther(balance)} ETH (minimum ${minimumBalanceText})`);
  console.log(`Monitors: ${monitors.join(', ')}`);
  console.log(
    `Gas: ${JSON.stringify({
      gasPrice: feeData.gasPrice?.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
    })}`
  );
  console.log('No transactions sent. Configuration is valid.');
}

main().catch(error => {
  console.error('DEPLOYMENT PREFLIGHT: FAIL');
  console.error(error.message);
  process.exitCode = 1;
});
