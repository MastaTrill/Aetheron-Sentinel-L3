import { ethers } from "hardhat";

/**
 * Minimal deployment to Amoy - just core contracts
 */
async function main() {
  console.log("Deploying Minimal to Amoy Testnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy SentinelInterceptor only
  console.log("1. Deploying SentinelInterceptor...");
  const SentinelInterceptor = await ethers.getContractFactory(
    "SentinelInterceptor",
  );
  const sentinel = await SentinelInterceptor.deploy(
    "0x0000000000000000000000000000000000000001",
    deployer.address,
  );
  await sentinel.waitForDeployment();
  console.log("   SentinelInterceptor:", await sentinel.getAddress());

  // Deploy AetheronBridge
  console.log("\n2. Deploying AetheronBridge...");
  const AetheronBridge = await ethers.getContractFactory("AetheronBridge");
  const bridge = await AetheronBridge.deploy(
    await sentinel.getAddress(),
    deployer.address,
    deployer.address,
  );
  await bridge.waitForDeployment();
  console.log("   AetheronBridge:", await bridge.getAddress());

  console.log("\n✅ Deployment Complete!");
  console.log("Sentinel:", await sentinel.getAddress());
  console.log("Bridge:", await bridge.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
