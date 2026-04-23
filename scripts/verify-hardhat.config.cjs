const path = require('path');
const { config: loadEnv } = require('dotenv');
const { defineConfig } = require('hardhat/config');

const verifyPluginModule = require(
  path.join(
    process.cwd(),
    '.verify-tools',
    'node_modules',
    '@nomicfoundation',
    'hardhat-verify',
  ),
);
const hardhatVerify = verifyPluginModule.default || verifyPluginModule;

loadEnv({
  path: path.resolve(__dirname, '..', '.env'),
  override: true,
});

const projectRoot = path.resolve(__dirname, '..');

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
      url:
        process.env.SEPOLIA_RPC_URL ||
        'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    mainnet: {
      type: 'http',
      chainType: 'l1',
      url:
        process.env.MAINNET_RPC_URL ||
        'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
    },
    hoodi: {
      type: 'http',
      chainType: 'l1',
      url:
        process.env.HOODI_RPC_URL ||
        'https://ethereum-hoodi-rpc.publicnode.com',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 560048,
    },
    baseSepolia: {
      type: 'http',
      chainType: 'l1',
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
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
