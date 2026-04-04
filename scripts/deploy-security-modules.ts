import { ethers } from "hardhat";

async function main() {
  console.log("\n========================================");
  console.log("Deploying Aetheron Sentinel Security Modules");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const moduleHubAddress = "0x0000000000000000000000000000000000000001"; // Replace with actual ModuleHub
  console.log("\n1. Deploying DynamicAccessControl...");
  const DynamicAccessControl = await ethers.getContractFactory(
    "DynamicAccessControl",
  );
  const accessControl = await DynamicAccessControl.deploy();
  await accessControl.waitForDeployment();
  console.log("   DynamicAccessControl:", await accessControl.getAddress());

  console.log("\n2. Deploying SelfHealingCircuitBreaker...");
  const SelfHealingCircuitBreaker = await ethers.getContractFactory(
    "SelfHealingCircuitBreaker",
  );
  const circuitBreaker = await SelfHealingCircuitBreaker.deploy();
  await circuitBreaker.waitForDeployment();
  console.log(
    "   SelfHealingCircuitBreaker:",
    await circuitBreaker.getAddress(),
  );

  console.log("\n3. Deploying TransactionSandbox...");
  const TransactionSandbox =
    await ethers.getContractFactory("TransactionSandbox");
  const sandbox = await TransactionSandbox.deploy();
  await sandbox.waitForDeployment();
  console.log("   TransactionSandbox:", await sandbox.getAddress());

  console.log("\n4. Deploying FormalVerifierHook...");
  const FormalVerifierHook =
    await ethers.getContractFactory("FormalVerifierHook");
  const formalVerifier = await FormalVerifierHook.deploy();
  await formalVerifier.waitForDeployment();
  console.log("   FormalVerifierHook:", await formalVerifier.getAddress());

  console.log("\n5. Deploying OnChainFuzzer...");
  const OnChainFuzzer = await ethers.getContractFactory("OnChainFuzzer");
  const fuzzer = await OnChainFuzzer.deploy();
  await fuzzer.waitForDeployment();
  console.log("   OnChainFuzzer:", await fuzzer.getAddress());

  console.log("\n6. Deploying ZKAttestationVerifier...");
  const ZKAttestationVerifier = await ethers.getContractFactory(
    "ZKAttestationVerifier",
  );
  const zkVerifier = await ZKAttestationVerifier.deploy();
  await zkVerifier.waitForDeployment();
  console.log("   ZKAttestationVerifier:", await zkVerifier.getAddress());

  console.log("\n7. Deploying ThreatOracle...");
  const ThreatOracle = await ethers.getContractFactory("ThreatOracle");
  const threatOracle = await ThreatOracle.deploy();
  await threatOracle.waitForDeployment();
  console.log("   ThreatOracle:", await threatOracle.getAddress());

  console.log("\n8. Deploying AutonomousPatcher...");
  const AutonomousPatcher =
    await ethers.getContractFactory("AutonomousPatcher");
  const patcher = await AutonomousPatcher.deploy(moduleHubAddress);
  await patcher.waitForDeployment();
  console.log("   AutonomousPatcher:", await patcher.getAddress());

  console.log("\n9. Deploying MemoryForensics...");
  const MemoryForensics = await ethers.getContractFactory("MemoryForensics");
  const memoryForensics = await MemoryForensics.deploy();
  await memoryForensics.waitForDeployment();
  console.log("   MemoryForensics:", await memoryForensics.getAddress());

  console.log("\n10. Deploying SentinelSecurityIntegration...");
  const SentinelSecurityIntegration = await ethers.getContractFactory(
    "SentinelSecurityIntegration",
  );
  const integration =
    await SentinelSecurityIntegration.deploy(moduleHubAddress);
  await integration.waitForDeployment();
  console.log(
    "   SentinelSecurityIntegration:",
    await integration.getAddress(),
  );

  console.log("\n11. Initializing Security Integration...");
  const tx = await integration.initializeSecurityModules(
    await accessControl.getAddress(),
    await patcher.getAddress(),
    await circuitBreaker.getAddress(),
    await formalVerifier.getAddress(),
    await sandbox.getAddress(),
    await fuzzer.getAddress(),
    await zkVerifier.getAddress(),
    await threatOracle.getAddress(),
    await memoryForensics.getAddress(),
  );
  await tx.wait();
  console.log("   Security modules initialized");

  console.log("\n========================================");
  console.log("SECURITY MODULES DEPLOYMENT COMPLETE");
  console.log("========================================\n");
  console.log("Deployed Contracts:");
  console.log("  DynamicAccessControl:", await accessControl.getAddress());
  console.log(
    "  SelfHealingCircuitBreaker:",
    await circuitBreaker.getAddress(),
  );
  console.log("  TransactionSandbox:", await sandbox.getAddress());
  console.log("  FormalVerifierHook:", await formalVerifier.getAddress());
  console.log("  OnChainFuzzer:", await fuzzer.getAddress());
  console.log("  ZKAttestationVerifier:", await zkVerifier.getAddress());
  console.log("  ThreatOracle:", await threatOracle.getAddress());
  console.log("  AutonomousPatcher:", await patcher.getAddress());
  console.log("  MemoryForensics:", await memoryForensics.getAddress());
  console.log("  SentinelSecurityIntegration:", await integration.getAddress());
  console.log("========================================\n");

  return {
    accessControl: await accessControl.getAddress(),
    circuitBreaker: await circuitBreaker.getAddress(),
    sandbox: await sandbox.getAddress(),
    formalVerifier: await formalVerifier.getAddress(),
    fuzzer: await fuzzer.getAddress(),
    zkVerifier: await zkVerifier.getAddress(),
    threatOracle: await threatOracle.getAddress(),
    patcher: await patcher.getAddress(),
    memoryForensics: await memoryForensics.getAddress(),
    integration: await integration.getAddress(),
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
