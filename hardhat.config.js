import { defineConfig } from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';
import hardhatEthersChaiMatchers from '@nomicfoundation/hardhat-ethers-chai-matchers';
import { config as loadEnv } from 'dotenv';

const shellOwnerKey = process.env.OWNER_PRIVATE_KEY;
const networkArgIndex = process.argv.indexOf('--network');
const requestedNetwork =
  process.env.HARDHAT_NETWORK ||
  process.env.npm_config_network ||
  (networkArgIndex >= 0 ? process.argv[networkArgIndex + 1] : undefined);

loadEnv();
if (requestedNetwork === 'mainnet') {
  loadEnv({ path: '.env.mainnet', override: true });
  if (shellOwnerKey !== undefined) process.env.OWNER_PRIVATE_KEY = shellOwnerKey;
  else delete process.env.OWNER_PRIVATE_KEY;
}

function getOwnerAccounts() {
  const ownerKey = (process.env.OWNER_PRIVATE_KEY || '').trim();
  return isRealPrivateKey(ownerKey) ? [ownerKey] : [];
}

function isRealPrivateKey(value) {
  return /^0x[0-9a-fA-F]{64}$/.test((value || '').trim());
}

function isRealRpcUrl(value) {
  const url = (value || '').trim();
  if (!url) return false;
  if (url.includes('YOUR_') || url.includes('your_') || url.endsWith('/v3/')) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasNetworkConfig(rpcUrl) {
  return isRealRpcUrl(rpcUrl) && getOwnerAccounts().length > 0;
}

function requireMainnetOwnerKey() {
  if (requestedNetwork === 'mainnet' && getOwnerAccounts().length === 0) {
    throw new Error(
      'Mainnet commands require OWNER_PRIVATE_KEY in the shell as a 0x-prefixed 32-byte hex key. Do not store it in .env.mainnet.'
    );
  }
}

requireMainnetOwnerKey();

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  plugins: [hardhatEthers, hardhatMocha, hardhatEthersChaiMatchers],
  solidity: {
    version: '0.8.28',
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
    },
    direct_l3: {
      type: 'http',
      url: 'http://127.0.0.1:8545',
      // Local dev only — use DIRECT_L3_PRIVATE_KEY env var (defaults to Hardhat account #0 for local simulation)
      accounts: process.env.DIRECT_L3_PRIVATE_KEY ? [process.env.DIRECT_L3_PRIVATE_KEY] : [],
    },
    ...(hasNetworkConfig(process.env.SEPOLIA_RPC_URL)
      ? {
          sepolia: {
            type: 'http',
            url: process.env.SEPOLIA_RPC_URL,
            accounts: getOwnerAccounts(),
          },
        }
      : {}),
    ...(hasNetworkConfig(process.env.MAINNET_RPC_URL)
      ? {
          mainnet: {
            type: 'http',
            url: process.env.MAINNET_RPC_URL,
            accounts: getOwnerAccounts(),
          },
        }
      : {}),
    ...(hasNetworkConfig(process.env.POLYGON_RPC_URL)
      ? {
          polygon: {
            type: 'http',
            url: process.env.POLYGON_RPC_URL,
            accounts: getOwnerAccounts(),
          },
        }
      : {}),
    ...(hasNetworkConfig(process.env.BASE_RPC_URL)
      ? {
          base: {
            type: 'http',
            url: process.env.BASE_RPC_URL,
            accounts: getOwnerAccounts(),
          },
        }
      : {}),
    ...(hasNetworkConfig(process.env.ARBITRUM_RPC_URL)
      ? {
          arbitrum: {
            type: 'http',
            url: process.env.ARBITRUM_RPC_URL,
            accounts: getOwnerAccounts(),
          },
        }
      : {}),
  },
};

export default defineConfig(config);
