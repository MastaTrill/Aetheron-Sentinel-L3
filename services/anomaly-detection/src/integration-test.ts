// Integration test for anomaly detection service with oracle
import { ethers } from "ethers";
import { AnomalyDetector } from "./detector";

async function testOracleIntegration() {
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");

  const config = {
    bridgeAddress: "0x...",
    sentinelAddress: "0x...",
    anomalyOracleAddress: "0x...",
    tvlSpikeThreshold: 1520,
    withdrawalWindow: 60 * 1000,
    monitoringInterval: 5000, // 5 seconds for testing
  };

  const detector = new AnomalyDetector(provider, config);

  console.log("Testing oracle integration...");

  // Listen for oracle reports
  detector.on("oracleReported", (data) => {
    console.log("Oracle report received:", data);
  });

  detector.start();

  // Wait 30 seconds for some monitoring cycles
  await new Promise((resolve) => setTimeout(resolve, 30000));

  detector.stop();
  console.log("Integration test completed");
}

// Run if called directly
if (require.main === module) {
  testOracleIntegration().catch(console.error);
}
