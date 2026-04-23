// Phase A telemetry data imported from Remix dashboard constants.
// Keep this file focused on UI seed data only; contract addresses remain in contracts.js.
window.SENTINEL_PHASE_A = {
  watchpoints: [
    { id: '1', label: 'ORDERBOOK DRIFT', status: 'stable', trend: [10, 12, 11, 14, 13, 15, 14] },
    { id: '2', label: 'PORTFOLIO BALANCE', status: 'stable', trend: [20, 18, 22, 21, 23, 22, 24] },
    { id: '3', label: 'CROSS-CHAIN SYNC', status: 'warning', trend: [15, 14, 16, 12, 10, 8, 12] },
    { id: '7', label: 'SETTLEMENT DELTA', status: 'warning', trend: [25, 24, 26, 22, 20, 18, 22] },
    { id: '10', label: 'NEGATIVE BALANCE', status: 'critical', trend: [5, 4, 6, 8, 12, 15, 18] }
  ],
  anomalies: [
    {
      id: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      severity: 'critical',
      source: 'Invariant Engine',
      message: 'Critical breach detected',
      txHash: '0xabc...def'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      severity: 'high',
      source: 'Identity Oracle',
      message: 'Unauthorized access attempt',
      txHash: '0xghi...jkl'
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      severity: 'high',
      source: 'Protocol Watcher',
      message: 'Protocol anomaly identified',
      txHash: '0xdef...123'
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      severity: 'medium',
      source: 'Logic Guard',
      message: 'Logical breach detected',
      txHash: '0x789...abc'
    }
  ],
  verdicts: [
    { id: '1', message: 'CROSS-CHAIN SYNC VERIFIED', block: 830192, status: 'verified' },
    { id: '2', message: 'SETTLEMENT DELTA ACCURATE', block: 830189, status: 'verified' },
    { id: '3', message: 'FEE CONSISTENCY ISSUE RESOLVED', block: 830187, status: 'resolved' },
    { id: '4', message: 'ORDERBOOK STABLE', block: 830185, status: 'stable' }
  ]
};
