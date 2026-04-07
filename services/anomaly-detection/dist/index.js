"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const ethers_1 = require("ethers");
const detector_1 = require("./detector");
const vulnerability_detector_1 = require("./vulnerability-detector");
const logger_1 = require("./logger");
const alerts_1 = require("./alerts");
const health_monitor_1 = require("./health-monitor");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Load environment variables
(0, dotenv_1.config)();
// Load alerts configuration
const alertsConfigPath = path.join(__dirname, "../config/alerts.json");
const alertsConfig = JSON.parse(fs.readFileSync(alertsConfigPath, "utf8"));
// Update oracle config with environment variables
if (alertsConfig.oracle) {
    alertsConfig.oracle.address =
        process.env.ANOMALY_ORACLE_ADDRESS || alertsConfig.oracle.address;
    alertsConfig.oracle.rpcUrl =
        process.env.RPC_URL || alertsConfig.oracle.rpcUrl;
    alertsConfig.oracle.privateKey =
        process.env.ORACLE_PRIVATE_KEY || alertsConfig.oracle.privateKey;
}
const serviceConfig = {
    // Contract addresses
    sentinelAddress: process.env.SENTINEL_ADDRESS || "0x...",
    bridgeAddress: process.env.BRIDGE_ADDRESS || "0x...",
    anomalyOracleAddress: process.env.ANOMALY_ORACLE_ADDRESS || "0x...",
    monitorAddress: process.env.MONITOR_ADDRESS || "0x...",
    // Blockchain connection
    rpcUrl: process.env.RPC_URL || "http://localhost:8545",
    // Thresholds
    tvlSpikeThreshold: 1520, // 15.20%
    withdrawalWindow: 60 * 1000, // 1 minute
    monitoringInterval: 1000, // 1 second
    confidenceThreshold: 0.8, // 80%
    // Alerting - now configured via alerts.json
    alertWebhook: process.env.ALERT_WEBHOOK || "",
    pagerdutyKey: process.env.PAGERDUTY_KEY || "",
};
async function main() {
    const logger = new logger_1.Logger();
    logger.info("Starting Anomaly Detection Service");
    logger.info(`Monitoring Bridge: ${serviceConfig.bridgeAddress}`);
    logger.info(`Sentinel: ${serviceConfig.sentinelAddress}`);
    // Initialize provider
    const provider = new ethers_1.ethers.JsonRpcProvider(serviceConfig.rpcUrl);
    // Initialize detectors
    const anomalyDetector = new detector_1.AnomalyDetector(provider, serviceConfig);
    const vulnerabilityDetector = new vulnerability_detector_1.VulnerabilityDetector(provider, {
        monitorAddress: serviceConfig.monitorAddress,
        confidenceThreshold: serviceConfig.confidenceThreshold,
        enableFlashLoanDetection: true,
        enableReentrancyDetection: true,
        monitoringInterval: serviceConfig.monitoringInterval,
    });
    const alerts = new alerts_1.AlertManager(alertsConfig);
    // Initialize health monitor
    const healthMonitor = new health_monitor_1.ServiceHealthMonitor(provider, {
        rpcUrl: serviceConfig.rpcUrl,
        bridgeAddress: serviceConfig.bridgeAddress,
        sentinelAddress: serviceConfig.sentinelAddress,
        anomalyOracleAddress: serviceConfig.anomalyOracleAddress,
    });
    // Health monitor event handlers
    healthMonitor.on("alert", (alert) => {
        logger.critical("Health Alert:", alert);
        alerts.sendAlert("CRITICAL", `Health Alert: ${alert.type}`, alert);
    });
    healthMonitor.on("healthCheck", (check) => {
        if (check.status !== "healthy") {
            logger.warn(`Health check ${check.status}: ${check.name}`);
        }
    });
    // Anomaly detector event handlers
    anomalyDetector.on("oracleRequest", (data) => {
        healthMonitor.recordRequest(data.success, data.responseTime);
    });
    anomalyDetector.on("tvlSpike", async (data) => {
        logger.warn("TVL Spike Detected!", data);
        await alerts.sendAlert("CRITICAL", "TVL Spike Detected", data);
    });
    anomalyDetector.on("largeWithdrawal", async (data) => {
        logger.warn("Large Withdrawal", data);
        await alerts.sendAlert("WARNING", "Large Withdrawal", data);
    });
    anomalyDetector.on("rapidDrain", async (data) => {
        logger.critical("Rapid Drain Pattern!", data);
        await alerts.sendAlert("CRITICAL", "Rapid Drain Pattern", data);
    });
    anomalyDetector.on("unusualActivity", async (data) => {
        logger.info("Unusual Activity", data);
        await alerts.sendAlert("INFO", "Unusual Activity", data);
    });
    anomalyDetector.on("performanceAlert", async (data) => {
        logger.warn("Performance Alert", data);
        await alerts.sendAlert("WARNING", "Performance Alert", data);
    });
    // Vulnerability detector event handlers
    vulnerabilityDetector.on("vulnerabilityDetected", async (data) => {
        logger.warn("Vulnerability Pattern Detected", data);
        await alerts.sendAlert("WARNING", "Vulnerability Pattern Detected", data);
    });
    vulnerabilityDetector.on("criticalVulnerability", async (data) => {
        logger.critical("CRITICAL VULNERABILITY DETECTED!", data);
        await alerts.sendAlert("CRITICAL", "Critical Vulnerability Detected", data);
    });
    vulnerabilityDetector.on("coordinatedAttack", async (data) => {
        logger.critical("COORDINATED ATTACK DETECTED!", data);
        await alerts.sendAlert("CRITICAL", "Coordinated Attack Detected", data);
    });
    // Start all services
    healthMonitor.start();
    anomalyDetector.start();
    vulnerabilityDetector.start();
    logger.info("Detection service running. Press Ctrl+C to stop.");
    logger.info(`Health monitoring: ${healthMonitor.getOverallHealth()}`);
    // Graceful shutdown
    process.on("SIGINT", () => {
        logger.info("Shutting down...");
        healthMonitor.stop();
        anomalyDetector.stop();
        vulnerabilityDetector.stop();
        process.exit(0);
    });
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map