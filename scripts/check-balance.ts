import { ethers } from "hardhat";

async function main() {
  console.log("\n========================================");
  console.log("Checking balances on available networks");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Check Sepolia balance
  try {
    const sepoliaProvider = new ethers.JsonRpcProvider(
      "https://ethereum-sepolia-rpc.publicnode.com/",
    );
    const sepoliaBalance = await sepoliaProvider.getBalance(deployer.address);
    console.log("Sepolia balance:", ethers.formatEther(sepoliaBalance), "ETH");
  } catch (e) {
    console.log("Sepolia check failed:", e);
  }

  // Check Amoy balance
  try {
    const amoyProvider = new ethers.JsonRpcProvider(
      "https://polygon-amoy.drpc.org",
    );
    const amoyBalance = await amoyProvider.getBalance(deployer.address);
    console.log("Amoy balance:", ethers.formatEther(amoyBalance), "MATIC");
  } catch (e) {
    console.log("Amoy check failed:", e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
