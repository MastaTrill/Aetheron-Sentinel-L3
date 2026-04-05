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

  // Deploy AetheronBridge first
  console.log("1. Deploying AetheronBridge...");
  const AetheronBridge = await ethers.getContractFactory("AetheronBridge");
  const placeholderSentinel = "0x" + "00".repeat(19) + "01";
  const bridge = await AetheronBridge.deploy(
    placeholderSentinel,
    deployer.address,
    deployer.address,
  );
  await bridge.waitForDeployment();
  console.log("   AetheronBridge:", await bridge.getAddress());

  // Deploy SentinelInterceptor
  console.log("\n2. Deploying SentinelInterceptor...");
  const SentinelInterceptor = await ethers.getContractFactory(
    "SentinelInterceptor",
  );
  const sentinel = await SentinelInterceptor.deploy(
    await bridge.getAddress(),
    deployer.address,
  );
  await sentinel.waitForDeployment();
  console.log("   SentinelInterceptor:", await sentinel.getAddress());

  // Update bridge with sentinel
  const tx = await bridge.setSentinel(await sentinel.getAddress());
  await tx.wait();

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
