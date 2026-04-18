import { ethers, network } from "hardhat";
import { promises as fs } from "fs";
import * as path from "path";

async function updateDeploymentArtifact(entries: Record<string, { address: string; startBlock: number }>) {
  if (network.name !== "sepolia") {
    return;
  }

  const artifactPath = path.join(process.cwd(), "subgraph", "deployments", "sepolia.json");
  let current: Record<string, { address: string; startBlock: number }> = {};

  try {
    current = JSON.parse(await fs.readFile(artifactPath, "utf-8"));
  } catch {
    current = {};
  }

  const next = { ...current, ...entries };
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, JSON.stringify(next, null, 2) + "\n", "utf-8");
  console.log(`Updated deployment artifact: ${artifactPath}`);
}

async function main() {
  console.log("\n========================================");
  console.log("Deploying Aetheron Sentinel Security Modules");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const sentinelAddress = process.env.SENTINEL_ADDRESS;
  if (!sentinelAddress) {
    throw new Error("SENTINEL_ADDRESS environment variable required");
  }
  console.log("Sentinel Address:", sentinelAddress);

  const sentinel = await ethers.getContractAt(
    "SentinelInterceptor",
    sentinelAddress,
  );

  console.log("\n1. Deploying AnomalyDetectionOracle...");
  const AnomalyDetectionOracle = await ethers.getContractFactory(
    "AnomalyDetectionOracle",
  );
  const anomalyOracle = await AnomalyDetectionOracle.deploy(sentinelAddress);
  await anomalyOracle.waitForDeployment();
  const anomalyOracleAddress = await anomalyOracle.getAddress();
  console.log("   AnomalyDetectionOracle:", anomalyOracleAddress);

  console.log("\n2. Deploying ExploitForecastOracle...");
  const ExploitForecastOracle = await ethers.getContractFactory(
    "ExploitForecastOracle",
  );
  const forecastOracle = await ExploitForecastOracle.deploy();
  await forecastOracle.waitForDeployment();
  const forecastOracleAddress = await forecastOracle.getAddress();
  console.log("   ExploitForecastOracle:", forecastOracleAddress);

  console.log("\n3. Deploying RateLimiter...");
  const maxWithdrawalPerWindow = BigInt(
    process.env.RATE_LIMIT_MAX_WITHDRAWAL_PER_WINDOW ?? "100000000000000000000000",
  );
  const windowDurationSeconds = BigInt(
    process.env.RATE_LIMIT_WINDOW_DURATION_SECONDS ?? "3600",
  );
  const RateLimiter = await ethers.getContractFactory("RateLimiter");
  const rateLimiter = await RateLimiter.deploy(
    maxWithdrawalPerWindow,
    windowDurationSeconds,
  );
  await rateLimiter.waitForDeployment();
  const rateLimiterAddress = await rateLimiter.getAddress();
  console.log("   RateLimiter:", rateLimiterAddress);

  console.log("\n4. Deploying CircuitBreaker...");
  const CircuitBreaker = await ethers.getContractFactory("CircuitBreaker");
  const circuitBreaker = await CircuitBreaker.deploy();
  await circuitBreaker.waitForDeployment();
  const circuitBreakerAddress = await circuitBreaker.getAddress();
  console.log("   CircuitBreaker:", circuitBreakerAddress);

  console.log("\n5. Granting ORACLE_ROLE to oracles in Sentinel...");
  const tx1 = await sentinel.grantRole(
    await sentinel.ORACLE_ROLE(),
    anomalyOracleAddress,
  );
  await tx1.wait();
  console.log("   Granted ORACLE_ROLE to AnomalyDetectionOracle");

  const tx2 = await sentinel.grantRole(
    await sentinel.ORACLE_ROLE(),
    forecastOracleAddress,
  );
  await tx2.wait();
  console.log("   Granted ORACLE_ROLE to ExploitForecastOracle");

  console.log("\n6. Granting management roles...");
  const tx3 = await anomalyOracle.grantRole(
    await anomalyOracle.REPORTER_ROLE(),
    deployer.address,
  );
  await tx3.wait();
  console.log("   Granted REPORTER_ROLE to deployer");

  const tx4 = await forecastOracle.grantRole(
    await forecastOracle.FORECASTER_ROLE(),
    deployer.address,
  );
  await tx4.wait();
  console.log("   Granted FORECASTER_ROLE to deployer");

  const tx5 = await rateLimiter.grantRole(
    await rateLimiter.MANAGER_ROLE(),
    sentinelAddress,
  );
  await tx5.wait();
  console.log("   Granted MANAGER_ROLE to SentinelInterceptor in RateLimiter");

  const tx6 = await circuitBreaker.grantRole(
    await circuitBreaker.SENTINEL_ROLE(),
    sentinelAddress,
  );
  await tx6.wait();
  console.log("   Granted SENTINEL_ROLE to SentinelInterceptor in CircuitBreaker");

  const rateLimiterDeploymentTx = rateLimiter.deploymentTransaction();
  if (!rateLimiterDeploymentTx) {
    throw new Error("Missing deployment transaction for RateLimiter");
  }
  const circuitBreakerDeploymentTx = circuitBreaker.deploymentTransaction();
  if (!circuitBreakerDeploymentTx) {
    throw new Error("Missing deployment transaction for CircuitBreaker");
  }

  const rateLimiterReceipt = await rateLimiterDeploymentTx.wait();
  const circuitBreakerReceipt = await circuitBreakerDeploymentTx.wait();

  await updateDeploymentArtifact({
    RateLimiter: {
      address: rateLimiterAddress,
      startBlock: rateLimiterReceipt?.blockNumber ?? 0,
    },
    CircuitBreaker: {
      address: circuitBreakerAddress,
      startBlock: circuitBreakerReceipt?.blockNumber ?? 0,
    },
  });

  console.log("\n========================================");
  console.log("SECURITY MODULES DEPLOYMENT COMPLETE");
  console.log("========================================\n");
  console.log("Deployed Contracts:");
  console.log("  AnomalyDetectionOracle:", anomalyOracleAddress);
  console.log("  ExploitForecastOracle:", forecastOracleAddress);
  console.log("  RateLimiter:", rateLimiterAddress);
  console.log("  CircuitBreaker:", circuitBreakerAddress);
  console.log("========================================\n");

  return {
    anomalyOracle: anomalyOracleAddress,
    forecastOracle: forecastOracleAddress,
    rateLimiter: rateLimiterAddress,
    circuitBreaker: circuitBreakerAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
