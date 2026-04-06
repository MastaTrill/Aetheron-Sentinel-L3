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
    unhealthyDuration: number; // seconds
    degradedDuration: number; // seconds
    highErrorRate: number; // percentage
    slowResponseTime: number; // milliseconds
  };
  notificationChannels: string[];
}

export class ServiceHealthMonitor extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private config: {
    rpcUrl: string;
    bridgeAddress: string;
    sentinelAddress: string;
    anomalyOracleAddress: string;
    checkInterval: number;
    alertConfig: AlertConfig;
  };

  private healthChecks: Map<string, HealthCheck> = new Map();
  private metrics: ServiceMetrics;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    provider: ethers.JsonRpcProvider,
    config: {
      rpcUrl: string;
      bridgeAddress: string;
      sentinelAddress: string;
      anomalyOracleAddress: string;
      checkInterval?: number;
      alertConfig?: Partial<AlertConfig>;
    },
  ) {
    super();

    this.provider = provider;
    this.config = {
      ...config,
      checkInterval: config.checkInterval || 30000, // 30 seconds
      alertConfig: {
        enabled: true,
        thresholds: {
          unhealthyDuration: 300, // 5 minutes
          degradedDuration: 60, // 1 minute
          highErrorRate: 10, // 10%
          slowResponseTime: 5000, // 5 seconds
        },
        notificationChannels: ["console", "event"],
        ...config.alertConfig,
      },
    };

    this.metrics = {
      uptime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastUpdated: Date.now(),
    };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("🩺 Starting service health monitoring...");

    // Initial health check
    this.performHealthChecks();

    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
      this.updateMetrics();
      this.checkAlerts();
    }, this.config.checkInterval);

    this.emit("started");
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log("🛑 Service health monitoring stopped");
    this.emit("stopped");
  }

  private async performHealthChecks(): Promise<void> {
    const checks = [
      this.checkRPCConnectivity.bind(this),
      this.checkBridgeContract.bind(this),
      this.checkSentinelContract.bind(this),
      this.checkAnomalyOracleContract.bind(this),
      this.checkNetworkLatency.bind(this),
    ];

    for (const check of checks) {
      try {
        await check();
      } catch (error) {
        console.error("Health check error:", error);
      }
    }
  }

  private async checkRPCConnectivity(): Promise<void> {
    const startTime = Date.now();

    try {
      const blockNumber = await this.provider.getBlockNumber();
      const responseTime = Date.now() - startTime;

      this.updateHealthCheck("rpc_connectivity", "healthy", responseTime, {
        blockNumber,
        responseTime,
      });
    } catch (error) {
      this.updateHealthCheck(
        "rpc_connectivity",
        "unhealthy",
        Date.now() - startTime,
        undefined,
        error.message,
      );
    }
  }

  private async checkBridgeContract(): Promise<void> {
    const startTime = Date.now();

    try {
      const bridge = new ethers.Contract(
        this.config.bridgeAddress,
        ["function totalValueLocked() view returns (uint256)"],
        this.provider,
      );

      const tvl = await bridge.totalValueLocked();
      const responseTime = Date.now() - startTime;

      this.updateHealthCheck("bridge_contract", "healthy", responseTime, {
        tvl: tvl.toString(),
        responseTime,
      });
    } catch (error) {
      this.updateHealthCheck(
        "bridge_contract",
        "unhealthy",
        Date.now() - startTime,
        undefined,
        error.message,
      );
    }
  }

  private async checkSentinelContract(): Promise<void> {
    const startTime = Date.now();

    try {
      const sentinel = new ethers.Contract(
        this.config.sentinelAddress,
        ["function paused() view returns (bool)"],
        this.provider,
      );

      const isPaused = await sentinel.paused();
      const responseTime = Date.now() - startTime;

      this.updateHealthCheck("sentinel_contract", "healthy", responseTime, {
        paused: isPaused,
        responseTime,
      });
    } catch (error) {
      this.updateHealthCheck(
        "sentinel_contract",
        "unhealthy",
        Date.now() - startTime,
        undefined,
        error.message,
      );
    }
  }

  private async checkAnomalyOracleContract(): Promise<void> {
    const startTime = Date.now();

    try {
      const oracle = new ethers.Contract(
        this.config.anomalyOracleAddress,
        ["function getCurrentRiskAssessment() view returns (uint256, uint256)"],
        this.provider,
      );

      const [riskLevel, avgProbability] =
        await oracle.getCurrentRiskAssessment();
      const responseTime = Date.now() - startTime;

      this.updateHealthCheck("anomaly_oracle", "healthy", responseTime, {
        riskLevel,
        avgProbability: avgProbability.toString(),
        responseTime,
      });
    } catch (error) {
      this.updateHealthCheck(
        "anomaly_oracle",
        "unhealthy",
        Date.now() - startTime,
        undefined,
        error.message,
      );
    }
  }

  private async checkNetworkLatency(): Promise<void> {
    const startTime = Date.now();

    try {
      // Perform multiple ping-like operations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(this.provider.getBlockNumber());
      }

      await Promise.all(promises);
      const responseTime = Date.now() - startTime;

      const avgLatency = responseTime / 5;
      const status = avgLatency > 2000 ? "degraded" : "healthy";

      this.updateHealthCheck("network_latency", status, avgLatency, {
        averageLatency: avgLatency,
        samples: 5,
      });
    } catch (error) {
      this.updateHealthCheck(
        "network_latency",
        "unhealthy",
        Date.now() - startTime,
        undefined,
        error.message,
      );
    }
  }

  private updateHealthCheck(
    name: string,
    status: "healthy" | "degraded" | "unhealthy",
    responseTime: number,
    details?: any,
    error?: string,
  ): void {
    const healthCheck: HealthCheck = {
      name,
      status,
      lastCheck: Date.now(),
      responseTime,
      error,
      details,
    };

    this.healthChecks.set(name, healthCheck);

    // Emit health status change
    this.emit("healthCheck", healthCheck);

    if (status === "unhealthy") {
      console.error(`🚨 Health check failed: ${name} - ${error}`);
    } else if (status === "degraded") {
      console.warn(`⚠️ Health check degraded: ${name}`);
    }
  }

  private updateMetrics(): void {
    this.metrics.uptime = Date.now() - this.metrics.lastUpdated;
    this.metrics.lastUpdated = Date.now();

    // Calculate error rate
    const errorRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100
        : 0;

    // Emit metrics update
    this.emit("metricsUpdate", { ...this.metrics, errorRate });
  }

  private checkAlerts(): void {
    if (!this.config.alertConfig.enabled) return;

    const now = Date.now();
    const thresholds = this.config.alertConfig.thresholds;

    // Check for unhealthy services
    for (const [name, check] of this.healthChecks) {
      if (check.status === "unhealthy") {
        const unhealthyDuration = (now - check.lastCheck) / 1000;
        if (unhealthyDuration > thresholds.unhealthyDuration) {
          this.emitAlert("service_unhealthy", {
            service: name,
            duration: unhealthyDuration,
            error: check.error,
          });
        }
      }
    }

    // Check error rate
    const errorRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100
        : 0;

    if (errorRate > thresholds.highErrorRate) {
      this.emitAlert("high_error_rate", {
        errorRate,
        totalRequests: this.metrics.totalRequests,
        failedRequests: this.metrics.failedRequests,
      });
    }

    // Check response time
    if (this.metrics.averageResponseTime > thresholds.slowResponseTime) {
      this.emitAlert("slow_response_time", {
        averageResponseTime: this.metrics.averageResponseTime,
        threshold: thresholds.slowResponseTime,
      });
    }
  }

  private emitAlert(type: string, data: any): void {
    const alert = {
      type,
      timestamp: Date.now(),
      data,
    };

    console.error(`🚨 Alert: ${type}`, data);

    this.emit("alert", alert);

    // Send to notification channels
    for (const channel of this.config.alertConfig.notificationChannels) {
      if (channel === "console") {
        // Already logged above
      } else if (channel === "event") {
        // Event already emitted
      }
      // Add more channels: email, slack, pagerduty, etc.
    }
  }

  // Public API methods
  getHealthStatus(): { [key: string]: HealthCheck } {
    const status: { [key: string]: HealthCheck } = {};
    for (const [name, check] of this.healthChecks) {
      status[name] = check;
    }
    return status;
  }

  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  recordRequest(success: boolean, responseTime: number): void {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update rolling average response time
    const alpha = 0.1; // Smoothing factor
    this.metrics.averageResponseTime =
      alpha * responseTime + (1 - alpha) * this.metrics.averageResponseTime;
  }

  getOverallHealth(): "healthy" | "degraded" | "unhealthy" {
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    for (const check of this.healthChecks.values()) {
      if (check.status === "healthy") healthyCount++;
      else if (check.status === "degraded") degradedCount++;
      else if (check.status === "unhealthy") unhealthyCount++;
    }

    if (unhealthyCount > 0) return "unhealthy";
    if (degradedCount > 0) return "degraded";
    return "healthy";
  }
}
