import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatEthersChaiMatchers from '@nomicfoundation/hardhat-ethers-chai-matchers';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';

loadEnv(); // do not override shell env vars with .env file placeholders

function readEnvValue(name: string): string | undefined {
  const value = process.env[name]?.trim();

  if (!value || value.startsWith('YOUR_')) {
    return undefined;
  }

  return value;
}

function readPrivateKey(): string[] {
  const privateKey =
    readEnvValue('PRIVATE_KEY') || readEnvValue('OWNER_PRIVATE_KEY');

  return privateKey ? [privateKey] : [];
}

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
      chainId: 31337,
      type: 'edr-simulated',
      forking: {
        url:
          readEnvValue('MAINNET_RPC_URL') ||
          'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
        // blockNumber: undefined, // Optionally set a recent block for deterministic results
      },
    },
    // 'mainnet-fork' network removed; use 'hardhat' with forking for dry runs
    sepolia: {
      url:
        readEnvValue('SEPOLIA_RPC_URL') ||
        'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      accounts: readPrivateKey(),
      chainId: 11155111,
      type: 'http',
    },
    mainnet: {
      url:
        readEnvValue('MAINNET_RPC_URL') ||
        'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
      accounts: readPrivateKey(),
      chainId: 1,
      type: 'http',
    },
    hoodi: {
      url:
        readEnvValue('HOODI_RPC_URL') ||
        'https://ethereum-hoodi-rpc.publicnode.com',
      accounts: readPrivateKey(),
      chainId: 560048,
      type: 'http',
    },
    baseSepolia: {
      url: readEnvValue('BASE_SEPOLIA_RPC_URL') || 'https://sepolia.base.org',
      accounts: readPrivateKey(),
      chainId: 84532,
      type: 'http',
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
