#!/usr/bin/env node
"use strict";
/**
 * Service Health Dashboard
 * Real-time monitoring dashboard for anomaly detection services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDashboard = startDashboard;
const health_monitor_1 = require("./health-monitor");
const ethers_1 = require("ethers");
const config = {
    rpcUrl: process.env.RPC_URL || "http://localhost:8545",
    bridgeAddress: process.env.BRIDGE_ADDRESS || "0x...",
    sentinelAddress: process.env.SENTINEL_ADDRESS || "0x...",
    anomalyOracleAddress: process.env.ANOMALY_ORACLE_ADDRESS || "0x...",
};
async function startDashboard() {
    const provider = new ethers_1.ethers.JsonRpcProvider(config.rpcUrl);
    const monitor = new health_monitor_1.ServiceHealthMonitor(provider, config);
    console.log("📊 Service Health Dashboard");
    console.log("==========================");
    monitor.on("healthCheck", (check) => {
        const status = getStatusIcon(check.status);
        console.log(`${status} ${check.name}: ${check.status} (${check.responseTime}ms)`);
        if (check.error) {
            console.log(`   Error: ${check.error}`);
        }
        if (check.details) {
            console.log(`   Details: ${JSON.stringify(check.details, null, 2)}`);
        }
    });
    monitor.on("metricsUpdate", (metrics) => {
        console.log("\n📈 Current Metrics:");
        console.log(`   Uptime: ${Math.floor(metrics.uptime / 1000)}s`);
        console.log(`   Requests: ${metrics.successfulRequests}/${metrics.totalRequests} successful`);
        console.log(`   Error Rate: ${((metrics.failedRequests / Math.max(metrics.totalRequests, 1)) * 100).toFixed(1)}%`);
        console.log(`   Avg Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`);
        console.log(`   Overall Health: ${getStatusIcon(monitor.getOverallHealth())} ${monitor.getOverallHealth()}`);
        console.log("─".repeat(50));
    });
    monitor.on("alert", (alert) => {
        console.log(`🚨 ALERT: ${alert.type.toUpperCase()}`);
        console.log(`   ${JSON.stringify(alert.data, null, 2)}`);
        console.log("─".repeat(50));
    });
    monitor.start();
    // Display initial status
    setTimeout(() => {
        const health = monitor.getHealthStatus();
        const metrics = monitor.getMetrics();
        console.log("\n🏥 Initial Health Status:");
        Object.values(health).forEach((check) => {
            const status = getStatusIcon(check.status);
            console.log(`${status} ${check.name}: ${check.status}`);
        });
        console.log("\n📊 Initial Metrics:");
        console.log(`Overall Health: ${getStatusIcon(monitor.getOverallHealth())} ${monitor.getOverallHealth()}`);
    }, 2000);
    // Graceful shutdown
    process.on("SIGINT", () => {
        console.log("\n🛑 Shutting down dashboard...");
        monitor.stop();
        process.exit(0);
    });
}
function getStatusIcon(status) {
    switch (status) {
        case "healthy":
            return "✅";
        case "degraded":
            return "⚠️";
        case "unhealthy":
            return "❌";
        default:
            return "❓";
    }
}
// Start dashboard if run directly
if (require.main === module) {
    startDashboard().catch(console.error);
}
//# sourceMappingURL=health-dashboard.js.map