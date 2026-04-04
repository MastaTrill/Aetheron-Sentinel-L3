import { ethers } from "hardhat";

/**
 * Deploy to local Hardhat network with mock tokens
 */
async function main() {
  console.log("Deploying to Local Network (Hardhat)...\n");

  const [deployer, user, relayer] = await ethers.getSigners();

  // Deploy Mock Token
  console.log("1. Deploying MockToken...");
  const MockToken = await ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy(
    "Mock USDC",
    "mUSDC",
    ethers.parseEther("1000000"),
  );
  await mockToken.waitForDeployment();
  console.log("   MockToken deployed to:", await mockToken.getAddress());

  // Deploy AetheronBridge first (placeholder) - SentinelInterceptor needs bridge address
  console.log("\n2. Deploying AetheronBridge...");
  const AetheronBridge = await ethers.getContractFactory("AetheronBridge");
  const bridge = await AetheronBridge.deploy(
    "0x0000000000000000000000000000000000000001",
    deployer.address,
    deployer.address,
  );
  await bridge.waitForDeployment();
  console.log("   AetheronBridge deployed to:", await bridge.getAddress());

  // Deploy SentinelInterceptor with bridge address
  console.log("\n3. Deploying SentinelInterceptor...");
  const SentinelInterceptor = await ethers.getContractFactory(
    "SentinelInterceptor",
  );
  const sentinel = await SentinelInterceptor.deploy(
    await bridge.getAddress(),
    deployer.address,
  );
  await sentinel.waitForDeployment();
  console.log(
    "   SentinelInterceptor deployed to:",
    await sentinel.getAddress(),
  );

  // Grant roles
  console.log("\n4. Configuring roles...");
  const relayerRole = await bridge.RELAYER_ROLE();
  const sentinelRole = await sentinel.SENTINEL_ROLE();
  await bridge.grantRole(relayerRole, relayer.address);
  await sentinel.grantRole(sentinelRole, await bridge.getAddress());
  console.log("   Roles configured");

  // Enable chains
  await bridge.setSupportedChain(1, true);
  await bridge.setSupportedChain(42161, true);
  console.log("5. Supported chains enabled: 1, 42161");

  // Fund user
  await mockToken.transfer(user.address, ethers.parseEther("10000"));
  console.log("\n6. Funded test user with 10,000 mUSDC");

  console.log("\n========================================");
  console.log("LOCAL DEPLOYMENT COMPLETE");
  console.log("========================================\n");
  console.log("Deployed Addresses:");
  console.log("  MockToken:", await mockToken.getAddress());
  console.log("  SentinelInterceptor:", await sentinel.getAddress());
  console.log("  AetheronBridge:", await bridge.getAddress());
  console.log("\nTest Accounts:");
  console.log("  Deployer:", deployer.address);
  console.log("  User:", user.address);
  console.log("  Relayer:", relayer.address);
  console.log("========================================\n");

  return {
    mockToken: await mockToken.getAddress(),
    sentinel: await sentinel.getAddress(),
    bridge: await bridge.getAddress(),
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
