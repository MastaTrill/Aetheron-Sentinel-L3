import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    direct_l3: {
      url: process.env.DIRECT_L3_RPC_URL || "http://127.0.0.1:8545",
      ...(process.env.DIRECT_L3_PRIVATE_KEY
        ? { accounts: [process.env.DIRECT_L3_PRIVATE_KEY] }
        : {}),
    },
  },
};

export default config;
