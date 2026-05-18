require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-ethers-chai-matchers");
require("@nomicfoundation/hardhat-verify");

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";

module.exports = {
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
    }
  }
};
