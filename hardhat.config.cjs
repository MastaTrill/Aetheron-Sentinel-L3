require("@nomicfoundation/hardhat-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
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
      url: "http://127.0.0.1:8545",
      // Using the ACTUAL Ganache Private Key (0) that has 1000 ETH
      accounts: ["0x916d2b372ba2f58298a30798ef027c25b0c1c388f04dfbf68769e232236fd4ae"],
    },
  },
};
