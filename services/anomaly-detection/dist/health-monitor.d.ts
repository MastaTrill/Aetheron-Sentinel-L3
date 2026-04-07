import { ethers } from "ethers";
import { EventEmitter } from "events";
/**
 * @title ServiceHealthMonitor
 * @notice Comprehensive health monitoring and metrics collection for anomaly detection services
 * @dev Monitors RPC connectivity, contract interactions, performance metrics, and system health
 */
interface HealthCheck {
    name: string;
    status: "healthy" | "degraded" | "unhealthy";
    lastCheck: number;
    responseTime: number;
    error?: string;
    details?: any;
}
interface ServiceMetrics {
    uptime: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    lastUpdated: number;
}
interface AlertConfig {
    enabled: boolean;
    thresholds: {
        unhealthyDuration: number;
        degradedDuration: number;
        highErrorRate: number;
        slowResponseTime: number;
    };
    notificationChannels: string[];
}
export declare class ServiceHealthMonitor extends EventEmitter {
    private provider;
    private config;
    private healthChecks;
    private metrics;
    private monitoringInterval;
    private isRunning;
    constructor(provider: ethers.JsonRpcProvider, config: {
        rpcUrl: string;
        bridgeAddress: string;
        sentinelAddress: string;
        anomalyOracleAddress: string;
        checkInterval?: number;
        alertConfig?: Partial<AlertConfig>;
    });
    start(): void;
    stop(): void;
    private performHealthChecks;
    private checkRPCConnectivity;
    private checkBridgeContract;
    private checkSentinelContract;
    private checkAnomalyOracleContract;
    private checkNetworkLatency;
    private updateHealthCheck;
    private updateMetrics;
    private checkAlerts;
    private emitAlert;
    getHealthStatus(): {
        [key: string]: HealthCheck;
    };
    getMetrics(): ServiceMetrics;
    recordRequest(success: boolean, responseTime: number): void;
    getOverallHealth(): "healthy" | "degraded" | "unhealthy";
}
export {};
//# sourceMappingURL=health-monitor.d.ts.map