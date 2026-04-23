import { ethers } from "hardhat";

async function main() {
  console.log("Deploying to Amoy (Low Gas)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  const gasPrice = { gasPrice: ethers.parseUnits("0.1", "gwei") };

  // Deploy AetheronBridge first (with placeholder sentinel)
  console.log("1. Deploying AetheronBridge...");
  const AetheronBridge = await ethers.getContractFactory("AetheronBridge");

  try {
    const placeholderSentinel = "0x" + "00".repeat(19) + "01";
    const bridge = await AetheronBridge.deploy(
      placeholderSentinel,
      deployer.address,
      deployer.address,
      gasPrice,
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
      gasPrice,
    );
    await sentinel.waitForDeployment();
    console.log("   SentinelInterceptor:", await sentinel.getAddress());

    // Update Bridge with sentinel address
    const tx = await bridge.setSentinel(await sentinel.getAddress());
    await tx.wait();
    console.log("\n✅ Deployment Complete!");
    console.log("Bridge:", await bridge.getAddress());
    console.log("Sentinel:", await sentinel.getAddress());
  } catch (e: any) {
    console.log("   Failed:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
