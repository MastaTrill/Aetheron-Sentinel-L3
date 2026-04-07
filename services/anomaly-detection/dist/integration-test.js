"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Integration test for anomaly detection service with oracle
const ethers_1 = require("ethers");
const detector_1 = require("./detector");
async function testOracleIntegration() {
    const provider = new ethers_1.ethers.JsonRpcProvider("http://localhost:8545");
    const config = {
        bridgeAddress: "0x...",
        sentinelAddress: "0x...",
        anomalyOracleAddress: "0x...",
        rpcUrl: "http://localhost:8545",
        tvlSpikeThreshold: 1520,
        withdrawalWindow: 60 * 1000,
        monitoringInterval: 5000, // 5 seconds for testing
    };
    const detector = new detector_1.AnomalyDetector(provider, config);
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
//# sourceMappingURL=integration-test.js.map