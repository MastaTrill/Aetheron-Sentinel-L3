# Joint Testing Environment Setup - Aetheron Sentinel L3 + BMNR

## Overview

This document outlines the setup for joint testing between Aetheron Sentinel L3 and BMNR systems to ensure seamless integration and coordinated security monitoring.

## Environment Configuration

### Test Networks

- **Primary Testnet**: Sepolia
- **Secondary Testnet**: Goerli (deprecated, migrate to Sepolia)
- **BMNR Testnet**: BMNR Internal Testnet

### Contract Deployments

#### Aetheron Contracts

```json
{
  "SentinelInterceptor": "0x...",
  "AetheronBridge": "0x...",
  "TimeLockVault": "0x...",
  "MultiSigGovernance": "0x...",
  "YieldAggregator": "0x...",
  "CircuitBreaker": "0x...",
  "RateLimiter": "0x...",
  "FlashLoanProtection": "0x...",
  "PriceOracle": "0x..."
}
```

#### BMNR Integration Points

```json
{
  "BMNRBridgeAPI": "https://test-api.bmnr.com",
  "BMNRMonitoringWS": "wss://test-ws.bmnr.com",
  "BMNRSharedDashboard": "https://test-dashboard.bmnr.com/shared"
}
```

## Testing Scenarios

### 1. Anomaly Detection Coordination

- **Objective**: Ensure BMNR alerts trigger Aetheron Sentinel responses
- **Test Flow**:
  1. BMNR detects bridge anomaly
  2. BMNR sends alert via API/WebSocket
  3. Aetheron Sentinel receives and validates alert
  4. Sentinel triggers autonomous pause if conditions met
  5. Both systems log coordinated response

### 2. Bridge Pause Synchronization

- **Objective**: Verify bridge state synchronization between systems
- **Test Flow**:
  1. Aetheron Sentinel initiates emergency pause
  2. BMNR receives pause notification
  3. BMNR updates internal bridge status
  4. Both systems prevent transactions during pause
  5. Resume process requires mutual confirmation

### 3. TVL Monitoring Integration

- **Objective**: Unified TVL tracking across both platforms
- **Test Flow**:
  1. Bridge transactions update TVL
  2. Both Aetheron and BMNR oracles report TVL
  3. Cross-validation of TVL data
  4. Alert if discrepancies exceed threshold

### 4. Multi-Sig Governance Testing

- **Objective**: Joint approval processes for critical actions
- **Test Flow**:
  1. Emergency withdrawal proposal created
  2. Requires approval from both Aetheron and BMNR signers
  3. Execution only after mutual confirmation

### 5. Performance Load Testing

- **Objective**: Ensure systems handle peak loads together
- **Test Flow**:
  1. Simulate high-frequency bridge transactions
  2. Monitor both systems' performance metrics
  3. Test circuit breaker activation under load
  4. Verify alert propagation speed

## Test Infrastructure

### Shared Test Environment

```bash
# Docker Compose for joint testing
version: '3.8'
services:
  aetheron-sentinel:
    image: aetheron/sentinel-l3:test
    environment:
      - BMNR_API_URL=https://test-api.bmnr.com
      - BMNR_WS_URL=wss://test-ws.bmnr.com
    ports:
      - "3000:3000"

  bmnr-bridge-monitor:
    image: bmnr/bridge-monitor:test
    environment:
      - AETHERON_SENTINEL_URL=http://aetheron-sentinel:3000
    ports:
      - "4000:4000"

  joint-dashboard:
    image: aetheron/joint-dashboard:test
    ports:
      - "5000:5000"
```

### Test Data Setup

```typescript
// Shared test data configuration
const testConfig = {
  initialTVL: ethers.parseEther("1000000"),
  testUsers: ["0xuser1...", "0xuser2..."],
  anomalyScenarios: [
    { type: "tvl_spike", threshold: 1520 },
    { type: "large_withdrawal", threshold: 100000 },
    { type: "rapid_drain", threshold: 10 },
  ],
};
```

## Monitoring and Alerting

### Joint Monitoring Dashboard

- Real-time TVL comparison
- Alert correlation between systems
- Performance metrics overlay
- Incident response timeline

### Alert Escalation Protocol

1. **Level 1**: Automatic alerts (TVL monitoring)
2. **Level 2**: Anomaly detection alerts
3. **Level 3**: Bridge pause events
4. **Level 4**: Multi-sig governance actions
5. **Level 5**: Emergency protocol activation

### Incident Response

- **Detection**: < 5 seconds
- **Alert Propagation**: < 2 seconds
- **Bridge Pause**: < 14ms (Aetheron) / < 10 seconds (BMNR)
- **Human Response**: < 5 minutes for critical incidents

## Communication Protocols

### API Integration

```typescript
// BMNR Alert API
interface BMNRAlert {
  id: string;
  type: "anomaly" | "pause" | "resume";
  severity: "low" | "medium" | "high" | "critical";
  data: any;
  timestamp: number;
}

// Aetheron Response API
interface AetheronResponse {
  alertId: string;
  action: "pause" | "resume" | "monitor";
  status: "acknowledged" | "executed" | "failed";
  details: any;
}
```

### WebSocket Communication

```typescript
// Real-time event streaming
const wsConfig = {
  aetheronEvents: ["anomaly_detected", "bridge_paused", "tvl_updated"],
  bmnrEvents: ["alert_triggered", "status_changed", "metric_updated"],
  sharedEvents: ["joint_pause", "coordinated_response"],
};
```

## Security Testing

### Penetration Testing Scope

- API endpoints between systems
- WebSocket connections
- Shared dashboard access
- Multi-sig proposal workflow
- Emergency protocols

### Load Testing Parameters

- Concurrent users: 10,000
- Transaction rate: 1,000 TPS
- Alert frequency: 100/minute
- Data retention: 30 days

## Deployment Checklist

### Pre-Deployment

- [ ] Contract deployments verified on testnet
- [ ] API keys and secrets configured
- [ ] Monitoring dashboards set up
- [ ] Alert escalation contacts defined
- [ ] Backup and recovery procedures tested

### Deployment Day

- [ ] Systems started in parallel
- [ ] Initial synchronization verified
- [ ] Test transactions executed
- [ ] Monitoring alerts validated
- [ ] Stakeholder notifications sent

### Post-Deployment

- [ ] 24/7 monitoring established
- [ ] Incident response procedures activated
- [ ] Performance baselines established
- [ ] Documentation updated

## Contact Information

- **Aetheron Team**: security@aetheron.com
- **BMNR Team**: integration@bmnr.com
- **Joint Escalation**: emergency@joint-aetheron-bmnr.com

## Version History

- v1.0 - Initial joint testing setup (April 2026)
