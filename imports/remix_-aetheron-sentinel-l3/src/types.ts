export interface SecurityModule {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'paused' | 'alert';
  type: 'interceptor' | 'oracle' | 'limiter' | 'breaker' | 'protection' | 'vault';
  lastCheck: string;
  description: string;
  quantumLoad: number; // 0 to 1
}

export interface Invariant {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'monitoring';
  lastVerified: string;
  category: 'financial' | 'access' | 'state';
}

export interface OperatorActivity {
  id: string;
  timestamp: string;
  operatorId: string;
  action: string;
  identityVerified: boolean;
  status: 'authorized' | 'flagged' | 'blocked';
}

export interface AnomalyLog {
  id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  message: string;
  txHash?: string;
}

export interface QuantumVault {
  id: string;
  name: string;
  status: 'locked' | 'unlocked' | 'processing';
  entropyLevel: number;
  decoherenceRate: number; // 0 to 1
  qubitStability: number; // 0 to 1
  lastSync: string;
  capacity: string;
}

export interface StateMachineNode {
  id: string;
  label: string;
  status: 'active' | 'idle' | 'warning' | 'lockdown';
  connections: string[];
  description?: string;
}

export interface StateTransition {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  trigger: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ThreatLocation {
  id: string;
  lat: number;
  lng: number;
  intensity: number;
  label: string;
}

export interface Watchpoint {
  id: string;
  label: string;
  status: 'stable' | 'warning' | 'critical';
  trend: number[];
}

export interface LedgerItem {
  id: string;
  label: string;
  value: string;
  status: 'reconciled' | 'pending' | 'error';
  trend: number[];
}

export interface Verdict {
  id: string;
  message: string;
  block: number;
  status: 'verified' | 'resolved' | 'stable';
}

export interface OrderbookStats {
  bidVol: string;
  askVol: string;
  spread: string;
  timeskew: string;
}

export interface Exploit {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file?: string;
  line?: number;
  remediationScript?: string;
}

export interface FuzzingTarget {
  id: string;
  target: string;
  status: 'fuzzing' | 'paused' | 'completed';
  crashes: number;
  coverage: number;
  runtime: string;
}

export interface BugBountyStats {
  totalEarned: string;
  vulnerabilitiesFound: number;
  rank: number;
  activePrograms: number;
}

export interface NetworkStats {
  tps: number;
  gasPrice: string;
  activeNodes: number;
  totalIntercepted: number;
  invariantsChecked: number;
}

export interface YieldAggregator {
  currentYield: number;
  targetYield: number;
  totalStaked: string;
  activePools: number;
  bmnrPower: number;
}

export interface RewardPool {
  id: string;
  name: string;
  apr: number;
  multiplier: string;
  status: 'active' | 'boosting' | 'stable';
}

export interface DarknetLeak {
  id: string;
  timestamp: string;
  source: string;
  leakType: 'credentials' | 'exploit' | 'intel';
  content: string;
  riskScore: number;
}

export interface ZKProof {
  id: string;
  timestamp: string;
  proofHash: string;
  circuit: string;
  status: 'verifying' | 'valid' | 'invalid';
  latency: number;
}
