const path = require('path');
const { config: loadEnv } = require('dotenv');
const { defineConfig } = require('hardhat/config');

const shellOwnerKey = process.env.OWNER_PRIVATE_KEY;
const networkArgIndex = process.argv.indexOf('--network');
const requestedNetwork =
  process.env.HARDHAT_NETWORK ||
  process.env.npm_config_network ||
  (networkArgIndex >= 0 ? process.argv[networkArgIndex + 1] : undefined);

const verifyPluginModule = require(
  path.join(process.cwd(), '.verify-tools', 'node_modules', '@nomicfoundation', 'hardhat-verify')
);
const hardhatVerify = verifyPluginModule.default || verifyPluginModule;

loadEnv({
  path: path.resolve(__dirname, '..', '.env'),
  override: true,
});
if (requestedNetwork === 'mainnet') {
  loadEnv({
    path: path.resolve(__dirname, '..', '.env.mainnet'),
    override: true,
  });
  if (shellOwnerKey !== undefined) process.env.OWNER_PRIVATE_KEY = shellOwnerKey;
  else delete process.env.OWNER_PRIVATE_KEY;
}

const projectRoot = path.resolve(__dirname, '..');
function isRealPrivateKey(value) {
  return /^0x[0-9a-fA-F]{64}$/.test((value || '').trim());
}
const ownerKey = (process.env.OWNER_PRIVATE_KEY || '').trim();
const ownerAccounts = isRealPrivateKey(ownerKey) ? [ownerKey] : [];

module.exports = defineConfig({
  plugins: [hardhatVerify],
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: 'edr-simulated',
      chainType: 'l1',
      chainId: 31337,
    },
    sepolia: {
      type: 'http',
      chainType: 'l1',
      url: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      accounts: ownerAccounts,
      chainId: 11155111,
    },
    mainnet: {
      type: 'http',
      chainType: 'l1',
      url: process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
      accounts: ownerAccounts,
      chainId: 1,
    },
    hoodi: {
      type: 'http',
      chainType: 'l1',
      url: process.env.HOODI_RPC_URL || 'https://ethereum-hoodi-rpc.publicnode.com',
      accounts: ownerAccounts,
      chainId: 560048,
    },
    baseSepolia: {
      type: 'http',
      chainType: 'l1',
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      accounts: ownerAccounts,
      chainId: 84532,
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || '',
    },
  },
  paths: {
    sources: path.join(projectRoot, 'contracts'),
    cache: path.join(projectRoot, 'cache'),
    artifacts: path.join(projectRoot, 'artifacts'),
  },
});
