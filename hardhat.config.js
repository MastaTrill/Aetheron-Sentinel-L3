import { defineConfig } from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';
import hardhatEthersChaiMatchers from '@nomicfoundation/hardhat-ethers-chai-matchers';

function getOwnerAccounts() {
  const ownerKey = (process.env.OWNER_PRIVATE_KEY || '').trim();
  return ownerKey ? [ownerKey] : [];
}

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  plugins: [hardhatEthers, hardhatMocha, hardhatEthersChaiMatchers],
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // Local simulation
      type: 'edr-simulated',
    },
    direct_l3: {
      type: 'http',
      url: 'http://127.0.0.1:8545',
      // Local dev only — use DIRECT_L3_PRIVATE_KEY env var (defaults to Hardhat account #0 for local simulation)
      accounts: process.env.DIRECT_L3_PRIVATE_KEY ? [process.env.DIRECT_L3_PRIVATE_KEY] : [],
    },
    ...(process.env.MAINNET_RPC_URL && process.env.OWNER_PRIVATE_KEY
      ? {
          mainnet: {
            type: 'http',
            url: process.env.MAINNET_RPC_URL,
            accounts: getOwnerAccounts(),
            gasPrice: 20000000000,
          },
        }
      : {}),
    ...(process.env.POLYGON_RPC_URL && process.env.OWNER_PRIVATE_KEY
      ? {
          polygon: {
            type: 'http',
            url: process.env.POLYGON_RPC_URL,
            accounts: getOwnerAccounts(),
            gasPrice: 40000000000,
          },
        }
      : {}),
    ...(process.env.BASE_RPC_URL && process.env.OWNER_PRIVATE_KEY
      ? {
          base: {
            type: 'http',
            url: process.env.BASE_RPC_URL,
            accounts: getOwnerAccounts(),
            gasPrice: 1000000000,
          },
        }
      : {}),
    ...(process.env.ARBITRUM_RPC_URL && process.env.OWNER_PRIVATE_KEY
      ? {
          arbitrum: {
            type: 'http',
            url: process.env.ARBITRUM_RPC_URL,
            accounts: getOwnerAccounts(),
            gasPrice: 2000000000,
          },
        }
      : {}),
  },
};

export default defineConfig(config);
