import 'dotenv/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatVerify from '@nomicfoundation/hardhat-verify';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';
import hardhatEthersChaiMatchers from '@nomicfoundation/hardhat-ethers-chai-matchers';
import { fileURLToPath } from 'node:url';

const LOCAL_SOLC_PATH = fileURLToPath(new URL('./node_modules/solc/soljson.js', import.meta.url));

function normalizePrivateKey(value) {
  let normalized = String(value || '')
    .trim()
    .replace(/^\uFEFF/, '');
  while (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) normalized = `0x${normalized}`;
  return normalized;
}

const DEPLOYER_PRIVATE_KEY = normalizePrivateKey(
  process.env.DEPLOYER_PRIVATE_KEY ||
    '0000000000000000000000000000000000000000000000000000000000000000'
);
const BRIDGE_PRIVATE_KEY = process.env.BRIDGE_PRIVATE_KEY || DEPLOYER_PRIVATE_KEY;

function getRpcUrl(envVar, fallback) {
  const url = process.env[envVar];
  if (!url || url.includes('YOUR_') || url.includes('your_')) {
    throw new Error(`Missing or invalid ${envVar} environment variable`);
  }
  return url;
}

const config = {
  plugins: [hardhatEthers, hardhatVerify, hardhatMocha, hardhatEthersChaiMatchers],
  paths: {
    contracts: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  solidity: {
    version: '0.8.28',
    path: LOCAL_SOLC_PATH,
    isolated: true,
    settings: {
      optimizer: { enabled: true, runs: 1000 },
      metadata: { bytecodeHash: 'none' },
      evmVersion: 'cancun',
    },
  },
  mocha: {
    timeout: 100000,
  },
  verify: {
    etherscan: {
      apiKey: process.env.BASESCAN_API_KEY || '',
    },
  },
  chainDescriptors: {
    84532: {
      name: 'Base Sepolia',
      blockExplorers: {
        etherscan: {
          name: 'BaseScan',
          url: 'https://sepolia.basescan.org',
          apiUrl: 'https://api-sepolia.basescan.org/api',
        },
      },
    },
    8453: {
      name: 'Base Mainnet',
      blockExplorers: {
        etherscan: {
          name: 'BaseScan',
          url: 'https://basescan.org',
          apiUrl: 'https://api.basescan.org/api',
        },
      },
    },
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
            chainId: 84532,
          },
          baseSepoliaBridge: {
            type: 'http',
            url: process.env.BASE_TESTNET_RPC_URL,
            accounts: [BRIDGE_PRIVATE_KEY],
            chainId: 84532,
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
    ...(process.env.BASE_MAINNET_RPC_URL
      ? {
          base: {
            type: 'http',
            url: process.env.BASE_MAINNET_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            chainId: 8453,
          },
        }
      : {}),
    ...(process.env.POLYGON_MAINNET_RPC_URL
      ? {
          polygon: {
            type: 'http',
            url: process.env.POLYGON_MAINNET_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            chainId: 137,
          },
        }
      : {}),
    ...(process.env.ARBITRUM_MAINNET_RPC_URL
      ? {
          arbitrum: {
            type: 'http',
            url: process.env.ARBITRUM_MAINNET_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            chainId: 42161,
          },
        }
      : {}),
  },
};

export default config;
