import { 
  SecurityModule, 
  AnomalyLog, 
  Invariant, 
  OperatorActivity, 
  QuantumVault, 
  StateMachineNode,
  StateTransition,
  ThreatLocation,
  DarknetLeak,
  ZKProof,
  Watchpoint,
  LedgerItem,
  Verdict,
  OrderbookStats,
  Exploit,
  FuzzingTarget,
  BugBountyStats,
  YieldAggregator,
  RewardPool
} from './types';

export const SECURITY_MODULES: SecurityModule[] = [
  {
    id: 'sentinel-l3',
    name: 'Quantum-Resistant L3 Core',
    address: '0xQ-CORE...999',
    status: 'active',
    type: 'interceptor',
    lastCheck: new Date().toISOString(),
    description: 'Advanced post-quantum lattice-based cryptographic coordination layer for invariant enforcement.',
    quantumLoad: 0.42
  },
  {
    id: 'execution-vault',
    name: 'Entangled Execution Vault',
    address: '0xVAULT...Q-ENT',
    status: 'active',
    type: 'vault',
    lastCheck: new Date().toISOString(),
    description: 'Quantum-entangled execution environment with zero-latency state sync.',
    quantumLoad: 0.15
  },
  {
    id: 'identity-oracle',
    name: 'Biometric Quantum Oracle',
    address: '0xID...Q-BIO',
    status: 'active',
    type: 'oracle',
    lastCheck: new Date().toISOString(),
    description: 'Multi-dimensional biometric validation using quantum state superposition.',
    quantumLoad: 0.68
  },
  {
    id: 'guardrail-limiter',
    name: 'Lattice Guardrail Limiter',
    address: '0xGUARD...Q-LAT',
    status: 'active',
    type: 'limiter',
    lastCheck: new Date().toISOString(),
    description: 'Enforces post-quantum cryptographic invariants on all cross-chain flows.',
    quantumLoad: 0.22
  }
];

export const MOCK_INVARIANTS: Invariant[] = [
  {
    id: 'inv-1',
    name: 'Total Supply Invariant',
    description: 'Sum of all balances must equal total supply at all times.',
    status: 'passed',
    lastVerified: new Date().toISOString(),
    category: 'financial'
  },
  {
    id: 'inv-2',
    name: 'Unauthorized Withdrawal Guard',
    description: 'No withdrawal exceeding 500 ETH without multi-sig validation.',
    status: 'monitoring',
    lastVerified: new Date().toISOString(),
    category: 'access'
  },
  {
    id: 'inv-3',
    name: 'Bridge Liquidity Invariant',
    description: 'Bridge collateral must exceed 110% of wrapped assets.',
    status: 'passed',
    lastVerified: new Date().toISOString(),
    category: 'financial'
  }
];

export const MOCK_OPERATOR_ACTIVITY: OperatorActivity[] = [
  {
    id: 'op-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    operatorId: 'Operator_0x44',
    action: 'Rebalance Liquidity Pool',
    identityVerified: true,
    status: 'authorized'
  },
  {
    id: 'op-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    operatorId: 'Operator_0x99',
    action: 'Update Oracle Parameters',
    identityVerified: true,
    status: 'flagged'
  }
];

export const MOCK_ANOMALIES: AnomalyLog[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    severity: 'critical',
    source: 'Invariant Engine',
    message: 'Critical Breach Detected',
    txHash: '0xabc...def'
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    severity: 'high',
    source: 'Identity Oracle',
    message: 'Unauthorized Access Attempt',
    txHash: '0xghi...jkl'
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    severity: 'high',
    source: 'Protocol Watcher',
    message: 'Protocol Anomaly Identified',
    txHash: '0xdef...123'
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    severity: 'medium',
    source: 'Logic Guard',
    message: 'Logical Breach Detected',
    txHash: '0x789...abc'
  }
];

export const QUANTUM_VAULTS: QuantumVault[] = [
  {
    id: 'qv-1',
    name: 'Primary Quantum Vault',
    status: 'locked',
    entropyLevel: 0.992,
    decoherenceRate: 0.001,
    qubitStability: 0.998,
    lastSync: new Date().toISOString(),
    capacity: '1.2 PB'
  },
  {
    id: 'qv-2',
    name: 'Secondary Shard Vault',
    status: 'processing',
    entropyLevel: 0.845,
    decoherenceRate: 0.012,
    qubitStability: 0.942,
    lastSync: new Date().toISOString(),
    capacity: '512 TB'
  }
];

export const STATE_MACHINE_NODES: StateMachineNode[] = [
  { id: 'node-1', label: 'INGRESS', status: 'active', connections: ['node-2'], description: 'L7 Protocol Interception' },
  { id: 'node-2', label: 'VERIFICATION', status: 'active', connections: ['node-3', 'node-4'], description: 'Lattice-based Validation' },
  { id: 'node-3', label: 'EXECUTION', status: 'warning', connections: ['node-5'], description: 'Atomic State Transition' },
  { id: 'node-4', label: 'LOCKDOWN', status: 'lockdown', connections: [], description: 'Emergency Circuit Breaker' },
  { id: 'node-5', label: 'SETTLEMENT', status: 'idle', connections: [], description: 'Finality Confirmation' }
];

export const STATE_TRANSITIONS: StateTransition[] = [
  { id: 'st-1', from: 'INGRESS', to: 'VERIFICATION', timestamp: new Date().toISOString(), trigger: 'Packet Received', severity: 'low' },
  { id: 'st-2', from: 'VERIFICATION', to: 'EXECUTION', timestamp: new Date().toISOString(), trigger: 'Auth Confirmed', severity: 'low' },
  { id: 'st-3', from: 'VERIFICATION', to: 'LOCKDOWN', timestamp: new Date().toISOString(), trigger: 'Anomaly Detected', severity: 'high' }
];

export const THREAT_LOCATIONS: ThreatLocation[] = [
  { id: 'tl-1', lat: 40.7128, lng: -74.0060, intensity: 0.8, label: 'New York' },
  { id: 'tl-2', lat: 51.5074, lng: -0.1278, intensity: 0.6, label: 'London' },
  { id: 'tl-3', lat: 35.6762, lng: 139.6503, intensity: 0.9, label: 'Tokyo' },
  { id: 'tl-4', lat: -33.8688, lng: 151.2093, intensity: 0.4, label: 'Sydney' },
  { id: 'tl-5', lat: 55.7558, lng: 37.6173, intensity: 0.7, label: 'Moscow' }
];

export const WATCHPOINTS: Watchpoint[] = [
  { id: '1', label: 'ORDERBOOK DRIFT', status: 'stable', trend: [10, 12, 11, 14, 13, 15, 14] },
  { id: '2', label: 'PORTFOLIO BALANCE', status: 'stable', trend: [20, 18, 22, 21, 23, 22, 24] },
  { id: '3', label: 'CROSS-CHAIN SYNC', status: 'warning', trend: [15, 14, 16, 12, 10, 8, 12] },
  { id: '4', label: 'AUCTION GHOST CHECK', status: 'stable', trend: [5, 6, 5, 7, 6, 8, 7] },
  { id: '5', label: 'TRADEPAIR INTEGRITY', status: 'stable', trend: [30, 32, 31, 33, 32, 34, 33] },
  { id: '6', label: 'FEE CONSISTENCY', status: 'stable', trend: [10, 11, 10, 12, 11, 13, 12] },
  { id: '7', label: 'SETTLEMENT DELTA', status: 'warning', trend: [25, 24, 26, 22, 20, 18, 22] },
  { id: '8', label: 'BRIDGE ORDERING', status: 'stable', trend: [40, 42, 41, 43, 42, 44, 43] },
  { id: '9', label: 'MINT/BURN AUTH', status: 'stable', trend: [15, 16, 15, 17, 16, 18, 17] },
  { id: '10', label: 'NEGATIVE BALANCE', status: 'critical', trend: [5, 4, 6, 8, 12, 15, 18] },
];

export const LEDGER_ITEMS: LedgerItem[] = [
  { id: '1', label: 'BTC DEPOSIT', value: '+1.5 BTC', status: 'reconciled', trend: [10, 12, 11, 13] },
  { id: '2', label: 'SUB TRANSFER', value: '-4000 USDT', status: 'pending', trend: [20, 18, 22, 21] },
  { id: '3', label: 'ETH WITHDRAW', value: '-2.3 ETH', status: 'reconciled', trend: [15, 14, 16, 15] },
  { id: '4', label: 'BRIDGE SYNC', value: 'RECONCILED', status: 'reconciled', trend: [30, 32, 31, 33] },
];

export const VERDICTS: Verdict[] = [
  { id: '1', message: 'CROSS-CHAIN SYNC VERIFIED', block: 830192, status: 'verified' },
  { id: '2', message: 'SETTLEMENT DELTA ACCURATE', block: 830189, status: 'verified' },
  { id: '3', message: 'FEE CONSISTENCY ISSUE RESOLVED', block: 830187, status: 'resolved' },
  { id: '4', message: 'ORDERBOOK STABLE', block: 830185, status: 'stable' },
];

export const ORDERBOOK_STATS: OrderbookStats = {
  bidVol: '125,600',
  askVol: '118,850',
  spread: '0.27%',
  timeskew: '< 150Ms'
};

export const MOCK_EXPLOITS: Exploit[] = [
  { 
    id: '1', 
    title: 'Reentrancy in Withdrawal', 
    severity: 'critical', 
    description: 'Unprotected call to external address before state update.', 
    file: 'Vault.sol', 
    line: 142,
    remediationScript: 'apply_reentrancy_guard.sh'
  },
  { 
    id: '2', 
    title: 'Integer Overflow', 
    severity: 'high', 
    description: 'Potential overflow in reward calculation.', 
    file: 'Staking.sol', 
    line: 89,
    remediationScript: 'use_safemath_v2.sh'
  },
  { 
    id: '3', 
    title: 'Weak Randomness', 
    severity: 'medium', 
    description: 'Usage of block.timestamp for random seed.', 
    file: 'Lottery.sol', 
    line: 45,
    remediationScript: 'integrate_chainlink_vrf.sh'
  },
  { 
    id: '4', 
    title: 'Unused Variable', 
    severity: 'low', 
    description: 'Variable "owner" is declared but never used.', 
    file: 'Base.sol', 
    line: 12 
  }
];

export const FUZZING_TARGETS: FuzzingTarget[] = [
  { id: 'f-1', target: 'AetheronBridge::swap', status: 'fuzzing', crashes: 0, coverage: 88.4, runtime: '14h 22m' },
  { id: 'f-2', target: 'SentinelCore::validate', status: 'fuzzing', crashes: 2, coverage: 94.1, runtime: '08h 10m' },
  { id: 'f-3', target: 'QuantumVault::decrypt', status: 'paused', crashes: 0, coverage: 42.0, runtime: '02h 45m' }
];

export const BUG_BOUNTY_STATS: BugBountyStats = {
  totalEarned: '$1,240,000',
  vulnerabilitiesFound: 142,
  rank: 4,
  activePrograms: 28
};

export const YIELD_STATS: YieldAggregator = {
  currentYield: 3.15,
  targetYield: 25.0,
  totalStaked: '42,069,000 BMNR',
  activePools: 12,
  bmnrPower: 15.4
};

export const REWARD_POOLS: RewardPool[] = [
  { id: 'rp-1', name: 'BMNR/ETH LP', apr: 18.5, multiplier: '2.5x', status: 'boosting' },
  { id: 'rp-2', name: 'BMNR SINGLE STAKE', apr: 12.2, multiplier: '1.8x', status: 'active' },
  { id: 'rp-3', name: 'SENTINEL GOVERNANCE', apr: 25.0, multiplier: '5.0x', status: 'boosting' },
  { id: 'rp-4', name: 'QUANTUM VAULT REWARDS', apr: 8.4, multiplier: '1.2x', status: 'stable' }
];

export const MOCK_LEAKS: DarknetLeak[] = [
  { id: 'l-1', timestamp: new Date().toISOString(), source: 'OnionScan', leakType: 'intel', content: 'Targeted DDoS planning detected in Sector 7', riskScore: 0.82 },
  { id: 'l-2', timestamp: new Date().toISOString(), source: 'LeakBot', leakType: 'credentials', content: 'Potential operator credential dump on BreachForums', riskScore: 0.95 }
];

export const MOCK_ZK_PROOFS: ZKProof[] = [
  { id: 'zk-1', timestamp: new Date().toISOString(), proofHash: '0xZK_A8F2E4D1C3B5A790B1C2D3E4F5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C0D1E2F3A4', circuit: 'AuthCircuit_v4', status: 'valid', latency: 42 },
  { id: 'zk-2', timestamp: new Date().toISOString(), proofHash: '0xZK_F1E2D3C4B5A69780C9D8B7A6F5E4D3C2B1A0F9E8D7C6B5A493827160A5B4C3D2', circuit: 'StateTransition_v1', status: 'verifying', latency: 128 }
];
