import { ethers } from "hardhat";

async function main() {
  console.log("\n========================================");
  console.log("Deploying AetheronModuleHub");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy AetheronModuleHub
  console.log("Deploying AetheronModuleHub...");
  const AetheronModuleHub =
    await ethers.getContractFactory("AetheronModuleHub");
  const hub = await AetheronModuleHub.deploy();
  await hub.waitForDeployment();
  const hubAddress = await hub.getAddress();
  console.log("  AetheronModuleHub deployed to:", hubAddress);

  console.log("\n✅ Hub deployment complete!");
  console.log("\nUse this address for VITE_HUB_ADDRESS:");
  console.log("  ", hubAddress);
  console.log("\n========================================\n");

  // Register some core modules (optional - deploy them first if needed)
  // For now, just deploy the hub

  return { hub: hubAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
