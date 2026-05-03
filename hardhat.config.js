import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-network-helpers';
import '@nomicfoundation/hardhat-verify';
import '@typechain/hardhat';

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
    },
    direct_l3: {
      url: 'http://127.0.0.1:8545',
      // Using the ACTUAL Ganache Private Key (0) that has 1000 ETH
      accounts: ['0x916d2b372ba2f58298a30798ef027c25b0c1c388f04dfbf68769e232236fd4ae'],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_KEY',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000, // 20 gwei
    },
  },
};

export default config;
