import '@nomicfoundation/hardhat-toolbox';

function getOwnerAccounts() {
  const ownerKey = (process.env.OWNER_PRIVATE_KEY || '').trim();
  return ownerKey ? [ownerKey] : [];
}

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
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
    mainnet: {
      type: 'http',
      url: process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_KEY',
      accounts: getOwnerAccounts(),
      gasPrice: 20000000000, // 20 gwei
    },
    polygon: {
      type: 'http',
      url: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      accounts: getOwnerAccounts(),
      gasPrice: 40000000000, // 40 gwei
    },
    base: {
      type: 'http',
      url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      accounts: getOwnerAccounts(),
      gasPrice: 1000000000, // 1 gwei (Base has very low fees)
    },
    arbitrum: {
      type: 'http',
      url: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      accounts: getOwnerAccounts(),
      gasPrice: 2000000000, // 2 gwei
    },
  },
};

export default config;
