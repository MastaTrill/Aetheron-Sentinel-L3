import { ethers } from "hardhat";

async function main() {
  console.log("\n========================================");
  console.log("Deploying Aetheron Sentinel Security Oracles");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Get sentinel address from environment or deploy first
  const sentinelAddress = process.env.SENTINEL_ADDRESS;
  if (!sentinelAddress) {
    throw new Error("SENTINEL_ADDRESS environment variable required");
  }
  console.log("Sentinel Address:", sentinelAddress);
  console.log("\n1. Deploying AnomalyDetectionOracle...");
  const AnomalyDetectionOracle = await ethers.getContractFactory(
    "AnomalyDetectionOracle",
  );
  const anomalyOracle = await AnomalyDetectionOracle.deploy(sentinelAddress);
  await anomalyOracle.waitForDeployment();
  console.log("   AnomalyDetectionOracle:", await anomalyOracle.getAddress());

  console.log("\n2. Deploying ExploitForecastOracle...");
  const ExploitForecastOracle = await ethers.getContractFactory(
    "ExploitForecastOracle",
  );
  const forecastOracle = await ExploitForecastOracle.deploy();
  await forecastOracle.waitForDeployment();
  console.log("   ExploitForecastOracle:", await forecastOracle.getAddress());

  console.log("\n3. Granting ORACLE_ROLE to oracles in Sentinel...");
  const sentinel = await ethers.getContractAt(
    "SentinelInterceptor",
    sentinelAddress,
  );

  // Grant ORACLE_ROLE to anomaly oracle
  const tx1 = await sentinel.grantRole(
    await sentinel.ORACLE_ROLE(),
    await anomalyOracle.getAddress(),
  );
  await tx1.wait();
  console.log("   Granted ORACLE_ROLE to AnomalyDetectionOracle");

  // Grant ORACLE_ROLE to forecast oracle (if it needs TVL updates)
  const tx2 = await sentinel.grantRole(
    await sentinel.ORACLE_ROLE(),
    await forecastOracle.getAddress(),
  );
  await tx2.wait();
  console.log("   Granted ORACLE_ROLE to ExploitForecastOracle");

  console.log(
    "\n4. Granting REPORTER_ROLE to deployer in AnomalyDetectionOracle...",
  );
  const tx3 = await anomalyOracle.grantRole(
    await anomalyOracle.REPORTER_ROLE(),
    deployer.address,
  );
  await tx3.wait();
  console.log("   Granted REPORTER_ROLE to deployer");

  console.log(
    "\n5. Granting FORECASTER_ROLE to deployer in ExploitForecastOracle...",
  );
  const tx4 = await forecastOracle.grantRole(
    await forecastOracle.FORECASTER_ROLE(),
    deployer.address,
  );
  await tx4.wait();
  console.log("   Granted FORECASTER_ROLE to deployer");

  console.log("\n========================================");
  console.log("SECURITY ORACLES DEPLOYMENT COMPLETE");
  console.log("========================================\n");
  console.log("Deployed Contracts:");
  console.log("  AnomalyDetectionOracle:", await anomalyOracle.getAddress());
  console.log("  ExploitForecastOracle:", await forecastOracle.getAddress());
  console.log("========================================\n");

  return {
    anomalyOracle: await anomalyOracle.getAddress(),
    forecastOracle: await forecastOracle.getAddress(),
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
