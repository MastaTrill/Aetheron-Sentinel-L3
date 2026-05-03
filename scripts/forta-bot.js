/**
 * Forta Detection Bot for Sentinel L3
 * Monitors Sentinel contracts for security anomalies
 */

const { Finding, FindingSeverity, FindingType } = require('forta-agent');

// Agent metadata
const metadata = {
  name: 'Sentinel L3 Security Monitor',
  description: 'Monitors Sentinel L3 contracts for security threats and anomalies',
  version: '1.0.0',
  authors: ['Aetheron Sentinel Team'],
  chainIds: [8453], // Base chain
};

// Sentinel contract addresses (update after deployment)
const SENTINEL_CONTRACTS = {
  interceptor: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  bridge: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  rateLimiter: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  circuitBreaker: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
};

/**
 * Handle transaction monitoring
 */
function handleTransaction(txEvent) {
  const findings = [];

  // Monitor large transfers to Sentinel contracts
  const transfers = txEvent.filterLog('Transfer', SENTINEL_CONTRACTS.bridge);
  transfers.forEach(transfer => {
    const amount = transfer.args.value;
    if (amount > ethers.utils.parseEther('1000')) {
      // Large transfer threshold
      findings.push(
        Finding.fromObject({
          name: 'Large Transfer to Sentinel Bridge',
          description: `Large token transfer detected: ${ethers.utils.formatEther(amount)} tokens`,
          alertId: 'SENTINEL-LARGE-TRANSFER',
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {
            contract: SENTINEL_CONTRACTS.bridge,
            amount: amount.toString(),
            from: transfer.args.from,
            to: transfer.args.to,
          },
        })
      );
    }
  });

  // Monitor anomaly detections
  const anomalies = txEvent.filterLog('AnomalyDetected', SENTINEL_CONTRACTS.interceptor);
  anomalies.forEach(anomaly => {
    findings.push(
      Finding.fromObject({
        name: 'Security Anomaly Detected',
        description: `Sentinel detected anomaly with severity ${anomaly.args.severity}`,
        alertId: 'SENTINEL-ANOMALY',
        severity: anomaly.args.severity > 7 ? FindingSeverity.High : FindingSeverity.Medium,
        type: FindingType.Suspicious,
        metadata: {
          contract: SENTINEL_CONTRACTS.interceptor,
          anomalyId: anomaly.args.anomalyId.toString(),
          severity: anomaly.args.severity.toString(),
          timestamp: anomaly.args.timestamp.toString(),
        },
      })
    );
  });

  // Monitor circuit breaker events
  const circuitEvents = txEvent.filterLog(
    ['CircuitOpened', 'CircuitClosed'],
    SENTINEL_CONTRACTS.circuitBreaker
  );
  circuitEvents.forEach(event => {
    const isOpen = event.name === 'CircuitOpened';
    findings.push(
      Finding.fromObject({
        name: `Circuit Breaker ${isOpen ? 'Opened' : 'Closed'}`,
        description: `Sentinel circuit breaker ${isOpen ? 'opened' : 'closed'} for chain ${event.args.chainId}`,
        alertId: `SENTINEL-CIRCUIT-${isOpen ? 'OPEN' : 'CLOSE'}`,
        severity: isOpen ? FindingSeverity.High : FindingSeverity.Info,
        type: FindingType.Info,
        metadata: {
          contract: SENTINEL_CONTRACTS.circuitBreaker,
          chainId: event.args.chainId.toString(),
          failureCount: event.args.failureCount?.toString() || 'N/A',
        },
      })
    );
  });

  return findings;
}

/**
 * Handle block monitoring
 */
function handleBlock(blockEvent) {
  const findings = [];

  // Monitor for unusual activity patterns
  // This would include more complex logic for pattern detection

  return findings;
}

module.exports = {
  metadata,
  handleTransaction,
  handleBlock,
};
