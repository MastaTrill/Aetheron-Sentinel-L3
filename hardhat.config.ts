import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatEthersChaiMatchers from '@nomicfoundation/hardhat-ethers-chai-matchers';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';

loadEnv({ override: true });

export default defineConfig({
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha],
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
  paths: {
    sources: './contracts',
    tests: {
      mocha: './test',
    },
    cache: './cache',
    artifacts: './artifacts',
  },
  test: {
    mocha: {
      timeout: 40000,
    },
  },
});
