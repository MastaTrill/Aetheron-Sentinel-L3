import { ethers } from "hardhat";

async function main() {
  console.log("Deploying to Amoy (Low Gas)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy SentinelInterceptor with low gas
  console.log("1. Deploying SentinelInterceptor...");
  const SentinelInterceptor = await ethers.getContractFactory(
    "SentinelInterceptor",
    {
      overrides: { gasPrice: ethers.parseUnits("0.1", "gwei") },
    },
  );

  try {
    const sentinel = await SentinelInterceptor.deploy(
      "0x0000000000000000000000000000000000000001",
      deployer.address,
    );
    await sentinel.waitForDeployment();
    console.log("   SentinelInterceptor:", await sentinel.getAddress());
  } catch (e: any) {
    console.log("   Failed:", e.message);
    return;
  }

  // Deploy AetheronBridge
  console.log("\n2. Deploying AetheronBridge...");
  const AetheronBridge = await ethers.getContractFactory("AetheronBridge", {
    overrides: { gasPrice: ethers.parseUnits("0.1", "gwei") },
  });

  try {
    const sentinelAddr = (
      await SentinelInterceptor.deploy(
        "0x0000000000000000000000000000000000000001",
        deployer.address,
      )
    ).waitForDeployment
      ? "0x"
      : "0x";

    const bridge = await AetheronBridge.deploy(
      "0x0000000000000000000000000000000000000001",
      deployer.address,
      deployer.address,
    );
    await bridge.waitForDeployment();
    console.log("   AetheronBridge:", await bridge.getAddress());
  } catch (e: any) {
    console.log("   Failed:", e.message);
  }

  console.log("\n✅ Deployment Complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
