# Service Health Monitoring

Comprehensive health monitoring and metrics collection system for anomaly detection services.

## Features

- **Multi-layer Health Checks**: Monitors RPC connectivity, contract interactions, and network latency
- **Real-time Metrics**: Tracks uptime, request success rates, response times, and error rates
- **Automated Alerts**: Configurable thresholds for health degradation and error rates
- **Dashboard Interface**: Real-time monitoring dashboard with status indicators
- **Event-driven Architecture**: Emits health events for integration with alerting systems

## Health Checks

### RPC Connectivity

- Monitors connection to Ethereum RPC endpoints
- Measures response times for block queries
- Detects network connectivity issues

### Contract Health

- **Bridge Contract**: Verifies TVL fetching and basic functionality
- **Sentinel Contract**: Checks pause status and accessibility
- **Anomaly Oracle**: Validates risk assessment queries

### Network Performance

- Measures average RPC response times
- Detects network congestion and latency issues
- Tracks block processing delays

## Metrics Collection

```typescript
interface ServiceMetrics {
  uptime: number; // Service uptime in milliseconds
  totalRequests: number; // Total API requests processed
  successfulRequests: number; // Successfully completed requests
  failedRequests: number; // Failed requests
  averageResponseTime: number; // Rolling average response time
  memoryUsage: number; // Memory usage (when available)
  cpuUsage: number; // CPU usage (when available)
}
```

## Alert Configuration

```typescript
interface AlertConfig {
  enabled: boolean;
  thresholds: {
    unhealthyDuration: number; // Seconds before marking unhealthy
    degradedDuration: number; // Seconds before marking degraded
    highErrorRate: number; // Error rate percentage threshold
    slowResponseTime: number; // Response time threshold in ms
  };
  notificationChannels: string[]; // ["console", "event", "email", etc.]
}
```

## Usage

### Basic Monitoring

```typescript
import { ServiceHealthMonitor } from "./health-monitor";

const monitor = new ServiceHealthMonitor(provider, {
  rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY",
  bridgeAddress: "0x...",
  sentinelAddress: "0x...",
  anomalyOracleAddress: "0x...",
  checkInterval: 30000, // 30 seconds
});

monitor.start();

// Listen for events
monitor.on("healthCheck", (check) => {
  console.log(`${check.name}: ${check.status}`);
});

monitor.on("alert", (alert) => {
  console.error("Alert:", alert);
});
```

### Dashboard

```bash
# Start real-time health dashboard
npm run health-dashboard
# or
npx ts-node src/health-dashboard.ts
```

### Integration with Services

```typescript
// In your service initialization
const healthMonitor = new ServiceHealthMonitor(provider, config);

// Record requests for metrics
healthMonitor.recordRequest(true, responseTime);

// Get current health status
const health = healthMonitor.getOverallHealth(); // "healthy" | "degraded" | "unhealthy"
const metrics = healthMonitor.getMetrics();
```

## Alert Types

- `service_unhealthy`: Service component is unhealthy for extended period
- `high_error_rate`: Error rate exceeds configured threshold
- `slow_response_time`: Average response time too high
- `rpc_connectivity`: RPC endpoint connectivity issues
- `contract_interaction`: Problems calling smart contracts

## Environment Variables

- `RPC_URL`: Ethereum RPC endpoint for monitoring
- `BRIDGE_ADDRESS`: Bridge contract address
- `SENTINEL_ADDRESS`: Sentinel contract address
- `ANOMALY_ORACLE_ADDRESS`: Anomaly oracle contract address
- `HEALTH_CHECK_INTERVAL`: Health check frequency in milliseconds (default: 30000)

## Health Status Indicators

- 🟢 **Healthy**: All systems operational
- 🟡 **Degraded**: Some issues detected, but functional
- 🔴 **Unhealthy**: Critical failures requiring attention

## Best Practices

1. **Monitor in Production**: Always enable health monitoring in production environments
2. **Configure Alerts**: Set up appropriate alerting for your infrastructure
3. **Regular Review**: Periodically review health check results and adjust thresholds
4. **Resource Monitoring**: Monitor memory and CPU usage for performance issues
5. **Historical Tracking**: Log health metrics for trend analysis and capacity planning
