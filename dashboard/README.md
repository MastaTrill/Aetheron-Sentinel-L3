# Aetheron Sentinel L3 Dashboard

Real-time analytics and monitoring dashboard for the Sentinel L3 ecosystem.

## Features

- **Security Monitoring**
  - Real-time TVL tracking with 1-second updates
  - Live anomaly alert dashboard with WebSocket streaming
  - Circuit breaker status with manual override controls
  - Response time metrics (4ms detection, 10ms execution, 14ms total)
  - Performance monitoring for WarpDrive workers
  - Multi-sig governance integration

- **Bridge Analytics**
  - Transfer volume with historical charts
  - Cross-chain statistics by network
  - User activity heatmaps
  - Fee analytics with gas optimization recommendations
  - Bridge health scores and latency monitoring

- **Governance**
  - Active proposals with real-time voting
  - Quadratic voting results and participation metrics
  - Multi-sig approval workflows
  - Treasury management controls
  - Emergency action panels

- **Insurance Pool**
  - Coverage statistics with utilization tracking
  - Claims dashboard with automated processing
  - Premium tracking with yield distribution
  - Risk assessment tools

- **Real-time Controls**
  - Emergency pause/unpause buttons
  - Threshold adjustment sliders
  - Circuit breaker reset controls
  - Multi-sig proposal creation
  - Alert acknowledgment system

## Quick Start

### Using Docker

```bash
cd dashboard
docker-compose up
```

Visit `http://localhost:3000`

### Using Local Development

```bash
cd dashboard
npm install
npm run dev
```

## Real-time Data Integration

### WebSocket Subscriptions

```typescript
// Real-time security status
subscription SecurityStatus {
  sentinelUpdated {
    id
    isPaused
    autonomousMode
    totalValueLocked
    lastAnomalyTimestamp
    circuitBreakerState
  }
}

// Live alert streaming
subscription AlertStream {
  anomalyAlert {
    id
    type
    severity
    tvlPercentage
    timestamp
    autoTriggered
    resolutionTime
  }
}

// Performance metrics
subscription PerformanceMetrics {
  warpDriveMetrics {
    activeWorkers
    averageLatency
    throughput
    errorRate
    lastUpdated
  }
}
```

### GraphQL Queries

#### Security Status with Performance

```graphql
query SecurityStatus {
  sentinels(first: 5) {
    id
    isPaused
    autonomousMode
    totalValueLocked
    totalAlerts
    totalPauses
    performanceMetrics {
      detectionLatency
      executionLatency
      totalResponseTime
      uptime
      accuracy
    }
  }
}
```

#### Recent Alerts with Actions

```graphql
query RecentAlerts {
  anomalyAlerts(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    tvlPercentage
    threshold
    autoTriggered
    timestamp
    acknowledged
    resolved
    actions {
      type
      executed
      timestamp
    }
  }
}
```

#### Bridge Volume with Predictions

```graphql
query BridgeVolume {
  dailyStats(first: 30, orderBy: date, orderDirection: desc) {
    date
    totalTransfers
    totalVolume
    totalAlerts
    predictedVolume
    anomalyScore
  }
}
```

#### Governance Proposals

```graphql
query GovernanceProposals {
  proposals(first: 10, where: { state: "Active" }) {
    id
    type
    description
    proposer
    yesVotes
    noVotes
    quorumRequired
    votingEnd
    canExecute
    executionTime
  }
}
```

#### BMNR Integration Queries

```graphql
# BMNR Bridge Metrics
query BMNRBridgeMetrics {
  bmnrMetrics(first: 10, orderBy: lastUpdated, orderDirection: desc) {
    id
    bridgeId
    tvl
    volume24h
    activeUsers
    securityScore
    lastUpdated
  }
}

# BMNR Alerts
query BMNRAlerts {
  bmnrAlerts(
    first: 20
    where: { resolved: false }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    type
    severity
    message
    bridgeId
    timestamp
  }
}

# BMNR Bridge Status
query BMNRBridgeStatus {
  bmnrBridgeStatuses {
    id
    status
    lastChecked
    uptime
    latency
  }
}
```

### Recent Alerts

```graphql
query RecentAlerts {
  anomalyAlerts(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    tvlPercentage
    threshold
    autoTriggered
    timestamp
  }
}
```

### Bridge Volume

```graphql
query BridgeVolume {
  dailyStats(first: 30, orderBy: date, orderDirection: desc) {
    date
    totalTransfers
    totalVolume
    totalAlerts
  }
}
```

## Environment Variables

```bash
NEXT_PUBLIC_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/aetheron/sentinel
NEXT_PUBLIC_WS_URL=http://localhost:8001/subgraphs/name/aetheron/sentinel
BMNR_API_URL=https://api.bmnr.com/v1
BMNR_API_KEY=your_bmnr_api_key
NEXT_PUBLIC_BMNR_WS_URL=wss://ws.bmnr.com
```

## Deployment

### Vercel

```bash
cd dashboard
vercel deploy
```

### Docker

```bash
docker build -t aetheron-dashboard .
docker run -p 3000:3000 aetheron-dashboard
```

## Real-time Controls

### Security Controls

- **Emergency Pause**: One-click bridge pause with multi-sig confirmation
- **Threshold Adjustment**: Sliders for TVL spike and other thresholds
- **Circuit Breaker Reset**: Manual circuit breaker state management
- **Autonomous Mode Toggle**: Enable/disable AI-driven responses

### Governance Controls

- **Proposal Creation**: Interface for submitting multi-sig proposals
- **Voting Interface**: Real-time voting on active proposals
- **Execution Panel**: Execute approved proposals with timelocks
- **Treasury Management**: Emergency withdrawal and fund allocation

### Alert Management

- **Alert Acknowledgment**: Mark alerts as reviewed
- **False Positive Reporting**: Flag incorrect detections
- **Alert Escalation**: Escalate to higher severity levels
- **Resolution Tracking**: Log incident response actions

## Components

- `SecurityPanel` - Main security status with real-time controls
- `TVLChart` - Interactive TVL chart with prediction overlays
- `AlertFeed` - Live anomaly alerts with action buttons
- `PerformanceMonitor` - WarpDrive worker metrics and health
- `TransferStats` - Bridge statistics with anomaly correlation
- `GovernancePanel` - Real-time proposal voting interface
- `InsuranceDashboard` - Coverage management with claims processing
- `EmergencyControls` - Critical action panel with confirmations
- `BMNRMetricsPanel` - BMNR bridge metrics integration
- `BMNRAlertPanel` - BMNR alert monitoring and management
- `JointMonitoringPanel` - Shared monitoring with BMNR systems

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- GraphQL (urql)
- Recharts
- Docker
