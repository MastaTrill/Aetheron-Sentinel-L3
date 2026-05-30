import 'dotenv/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatVerify from '@nomicfoundation/hardhat-verify';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';
import hardhatEthersChaiMatchers from '@nomicfoundation/hardhat-ethers-chai-matchers';

const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  '0000000000000000000000000000000000000000000000000000000000000000';
const BRIDGE_PRIVATE_KEY = process.env.BRIDGE_PRIVATE_KEY || DEPLOYER_PRIVATE_KEY;

function getRpcUrl(envVar, fallback) {
  const url = process.env[envVar];
  if (!url || url.includes('YOUR_') || url.includes('your_')) {
    throw new Error(`Missing or invalid ${envVar} environment variable`);
  }
  return url;
}

export default {
  plugins: [hardhatEthers, hardhatVerify, hardhatMocha, hardhatEthersChaiMatchers],
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 1000 }, // Optimized for OZ v5 tax logic & gas efficiency
      metadata: { bytecodeHash: 'none' },
      evmVersion: 'cancun',
    },
  },
  mocha: {
    timeout: 100000, // Extended for evmbench iterations
  },
  networks: {
    hardhat: {
      type: 'edr-simulated',
    },
    ...(process.env.BASE_TESTNET_RPC_URL
      ? {
          baseSepolia: {
            type: 'http',
            url: process.env.BASE_TESTNET_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
          },
          baseSepoliaBridge: {
            type: 'http',
            url: process.env.BASE_TESTNET_RPC_URL,
            accounts: [BRIDGE_PRIVATE_KEY],
          },
        }
      : {}),
    ...(process.env.SEPOLIA_RPC_URL
      ? {
          sepolia: {
            type: 'http',
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            gasPrice: 20000000000,
          },
        }
      : {}),
    ...(process.env.MAINNET_RPC_URL
      ? {
          mainnet: {
            type: 'http',
            url: process.env.MAINNET_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            gasPrice: 20000000000,
          },
        }
      : {}),
  },
};
