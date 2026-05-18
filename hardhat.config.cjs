require("dotenv").config();
const hardhatEthers = require("@nomicfoundation/hardhat-ethers").default;
const hardhatVerify = require("@nomicfoundation/hardhat-verify").default;

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";

module.exports = {
  plugins: [
    hardhatEthers,
    hardhatVerify
  ],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      metadata: { bytecodeHash: "none" },
      evmVersion: "cancun"
    }
  },
  networks: {
    hardhat: {
      type: "edr-simulated"
    },
    baseTestnet: {
      type: "http",
      url: process.env.BASE_TESTNET_RPC_URL || "https://sepolia.base.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 84532
    },
    sepolia: {
      type: "http",
      url: process.env.BASE_TESTNET_RPC_URL || "https://sepolia.base.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 84532
    },
    mainnet: {
      type: "http",
      url: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 8453
    }
  }
};
