/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  AlertTriangle,
  Lock,
  RefreshCw,
  Terminal,
  Settings,
  Globe,
  Database,
  ChevronRight,
  ArrowRight,
  Maximize2,
  Ghost,
  CheckCircle2,
  Info,
  Layers,
  Search,
  Zap,
  Target,
  Trophy,
  Bug,
  Cpu as QuantumIcon,
  Crosshair,
  Eye,
  Radar,
  Coins,
  TrendingUp,
  Gift,
  Flame,
  ClipboardList,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  ListFilter,
  Power,
  Pause,
  Play,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  BarChart,
  Bar,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

import {
  WATCHPOINTS,
  LEDGER_ITEMS,
  VERDICTS,
  ORDERBOOK_STATS,
  MOCK_EXPLOITS,
  FUZZING_TARGETS,
  BUG_BOUNTY_STATS,
  YIELD_STATS,
  REWARD_POOLS,
  SECURITY_MODULES,
  MOCK_ANOMALIES,
  STATE_MACHINE_NODES,
  STATE_TRANSITIONS,
  THREAT_LOCATIONS,
  QUANTUM_VAULTS,
  MOCK_LEAKS,
  MOCK_ZK_PROOFS,
  MOCK_OPERATOR_ACTIVITY,
} from './constants';
import {
  Watchpoint,
  LedgerItem,
  Verdict,
  OrderbookStats,
  Exploit,
  FuzzingTarget,
  BugBountyStats,
  YieldAggregator,
  RewardPool,
  SecurityModule,
  NetworkStats,
  AnomalyLog,
  StateMachineNode,
  StateTransition,
  ThreatLocation,
  QuantumVault,
  DarknetLeak,
  ZKProof,
  OperatorActivity,
} from './types';

// Sparkline Component
const Sparkline = ({ data, status }: { data: number[]; status: string }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 20;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((d - min) / range) * height,
  }));

  const pathData = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={pathData} className={`sparkline-path sparkline-${status}`} />
    </svg>
  );
};

// Mock Orderbook Chart Data
const ORDERBOOK_DATA = Array.from({ length: 40 }, (_, i) => {
  const x = i - 20;
  const bid = Math.exp(-Math.pow(x + 8, 2) / 30) * 100;
  const ask = Math.exp(-Math.pow(x - 8, 2) / 30) * 100;
  return {
    index: i,
    bid: bid + Math.random() * 10,
    ask: ask + Math.random() * 10,
  };
});

// Global Threat Map Component
const GlobalThreatMap = ({ threats }: { threats: ThreatLocation[] }) => {
  return (
    <div className="relative w-full h-48 bg-black/40 rounded border border-primary/10 overflow-hidden group">
      <div className="absolute inset-0 opacity-20">
        <svg viewBox="0 0 800 400" className="w-full h-full">
          <path
            d="M150,100 Q200,50 300,100 T500,100 T700,150"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-primary/20"
          />
          <path
            d="M100,250 Q250,300 400,250 T700,200"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-primary/20"
          />
          {/* Simplified World Map Outlines */}
          <rect
            x="100"
            y="80"
            width="120"
            height="80"
            rx="10"
            fill="currentColor"
            className="text-primary/5"
          />
          <rect
            x="350"
            y="60"
            width="150"
            height="100"
            rx="10"
            fill="currentColor"
            className="text-primary/5"
          />
          <rect
            x="550"
            y="120"
            width="100"
            height="120"
            rx="10"
            fill="currentColor"
            className="text-primary/5"
          />
          <rect
            x="150"
            y="220"
            width="180"
            height="120"
            rx="10"
            fill="currentColor"
            className="text-primary/5"
          />
        </svg>
      </div>

      {/* Threat Blips */}
      {threats.map((threat) => (
        <motion.div
          key={threat.id}
          className="absolute w-2 h-2 rounded-full bg-red-500"
          style={{
            left: `${((threat.lng + 180) / 360) * 100}%`,
            top: `${((90 - threat.lat) / 180) * 100}%`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        >
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="text-[8px] font-mono font-bold text-red-500 bg-black/80 px-1 rounded border border-red-500/30">
              {threat.label} [{Math.round(threat.intensity * 100)}%]
            </span>
          </div>
        </motion.div>
      ))}

      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <Radar className="w-3 h-3 text-primary animate-spin-slow" />
        <span className="text-[8px] font-mono text-primary/60 uppercase tracking-widest">
          Global Threat Radar: Active
        </span>
      </div>
    </div>
  );
};

// State Machine HUD Component
const StateMachineHUD = ({
  nodes,
  transitions,
  onNodeClick,
  selectedNodeId,
}: {
  nodes: StateMachineNode[];
  transitions: StateTransition[];
  onNodeClick: (id: string) => void;
  selectedNodeId: string | null;
}) => {
  const isPathHighlighted = (fromId: string, toId: string) => {
    if (!selectedNodeId) return false;
    if (selectedNodeId !== fromId) return false;

    const targetNode = nodes.find((n) => n.id === toId);
    return targetNode?.status === 'active';
  };

  return (
    <div className="flex flex-col gap-4 relative">
      {/* SVG Connections Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 px-4">
        <svg className="w-full h-10 overflow-visible">
          <defs>
            <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="0.3" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient
              id="line-grad-highlight"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#00f2ff" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#00f2ff" stopOpacity="1" />
              <stop offset="100%" stopColor="#00f2ff" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          {/* Node 1 to 2 */}
          <motion.line
            x1="10%"
            y1="20"
            x2="30%"
            y2="20"
            stroke={
              isPathHighlighted('node-1', 'node-2')
                ? 'url(#line-grad-highlight)'
                : 'url(#line-grad)'
            }
            strokeWidth={isPathHighlighted('node-1', 'node-2') ? '2' : '1'}
            className={
              isPathHighlighted('node-1', 'node-2')
                ? 'text-primary shadow-[0_0_10px_#00f2ff]'
                : 'text-primary'
            }
            strokeDasharray={
              isPathHighlighted('node-1', 'node-2') ? 'none' : '4 2'
            }
            animate={
              isPathHighlighted('node-1', 'node-2')
                ? { strokeDashoffset: [0, -24], opacity: [0.6, 1, 0.6] }
                : { strokeDashoffset: [0, -12] }
            }
            transition={{
              duration: isPathHighlighted('node-1', 'node-2') ? 1 : 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
          {/* Node 2 to 3 */}
          <motion.line
            x1="30%"
            y1="20"
            x2="50%"
            y2="20"
            stroke={
              isPathHighlighted('node-2', 'node-3')
                ? 'url(#line-grad-highlight)'
                : 'url(#line-grad)'
            }
            strokeWidth={isPathHighlighted('node-2', 'node-3') ? '2' : '1'}
            className={
              isPathHighlighted('node-2', 'node-3')
                ? 'text-primary shadow-[0_0_10px_#00f2ff]'
                : 'text-primary'
            }
            strokeDasharray={
              isPathHighlighted('node-2', 'node-3') ? 'none' : '4 2'
            }
            animate={
              isPathHighlighted('node-2', 'node-3')
                ? { strokeDashoffset: [0, -24], opacity: [0.6, 1, 0.6] }
                : { strokeDashoffset: [0, -12] }
            }
            transition={{
              duration: isPathHighlighted('node-2', 'node-3') ? 1 : 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
          {/* Node 2 to 4 */}
          <motion.path
            d="M 30% 20 Q 50% 40 70% 20"
            fill="none"
            stroke={
              isPathHighlighted('node-2', 'node-4')
                ? 'url(#line-grad-highlight)'
                : 'url(#line-grad)'
            }
            strokeWidth={isPathHighlighted('node-2', 'node-4') ? '2' : '1'}
            className={
              isPathHighlighted('node-2', 'node-4')
                ? 'text-primary shadow-[0_0_10px_#00f2ff]'
                : 'text-primary'
            }
            strokeDasharray={
              isPathHighlighted('node-2', 'node-4') ? 'none' : '4 2'
            }
            animate={
              isPathHighlighted('node-2', 'node-4')
                ? { strokeDashoffset: [0, -24], opacity: [0.6, 1, 0.6] }
                : { strokeDashoffset: [0, -12] }
            }
            transition={{
              duration: isPathHighlighted('node-2', 'node-4') ? 1.5 : 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
          {/* Node 3 to 5 */}
          <motion.line
            x1="50%"
            y1="20"
            x2="90%"
            y2="20"
            stroke={
              isPathHighlighted('node-3', 'node-5')
                ? 'url(#line-grad-highlight)'
                : 'url(#line-grad)'
            }
            strokeWidth={isPathHighlighted('node-3', 'node-5') ? '2' : '1'}
            className={
              isPathHighlighted('node-3', 'node-5')
                ? 'text-primary shadow-[0_0_10px_#00f2ff]'
                : 'text-primary'
            }
            strokeDasharray={
              isPathHighlighted('node-3', 'node-5') ? 'none' : '4 2'
            }
            animate={
              isPathHighlighted('node-3', 'node-5')
                ? { strokeDashoffset: [0, -24], opacity: [0.6, 1, 0.6] }
                : { strokeDashoffset: [0, -12] }
            }
            transition={{
              duration: isPathHighlighted('node-3', 'node-5') ? 1 : 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </svg>
      </div>

      <div className="grid grid-cols-5 gap-2 relative z-10">
        {nodes.map((node) => (
          <div key={node.id} className="flex flex-col items-center gap-2">
            <motion.div
              onClick={() => onNodeClick(node.id)}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-500 ${
                selectedNodeId === node.id
                  ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-black'
                  : ''
              } ${
                node.status === 'active'
                  ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(0,242,255,0.3)]'
                  : node.status === 'lockdown'
                    ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                    : node.status === 'warning'
                      ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                      : 'border-primary/20 bg-black/40'
              }`}
              animate={
                node.status === 'lockdown'
                  ? { scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }
                  : node.status === 'warning'
                    ? { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }
                    : node.status === 'active'
                      ? {
                          boxShadow: [
                            '0 0 5px rgba(0,242,255,0.2)',
                            '0 0 20px rgba(0,242,255,0.5)',
                            '0 0 5px rgba(0,242,255,0.2)',
                          ],
                        }
                      : {}
              }
              transition={{
                duration: node.status === 'lockdown' ? 1 : 2,
                repeat: Infinity,
              }}
            >
              <Layers
                className={`w-4 h-4 ${
                  node.status === 'active'
                    ? 'text-primary'
                    : node.status === 'lockdown'
                      ? 'text-red-500'
                      : node.status === 'warning'
                        ? 'text-yellow-500'
                        : 'text-primary/20'
                }`}
              />
            </motion.div>
            <span
              className={`text-[7px] font-bold uppercase tracking-widest text-center ${
                node.status === 'active'
                  ? 'text-primary'
                  : node.status === 'lockdown'
                    ? 'text-red-500'
                    : node.status === 'warning'
                      ? 'text-yellow-500'
                      : 'text-primary/40'
              }`}
            >
              {node.label}
            </span>
          </div>
        ))}
      </div>

      {/* Node Info Panel */}
      <AnimatePresence mode="wait">
        {selectedNodeId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-3 rounded border border-primary/20 bg-primary/5 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                {nodes.find((n) => n.id === selectedNodeId)?.label} NODE
              </span>
              <Badge
                variant="outline"
                className="text-[7px] border-primary/30 text-primary/60"
              >
                STATUS:{' '}
                {nodes
                  .find((n) => n.id === selectedNodeId)
                  ?.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-[9px] text-primary/80 font-mono leading-relaxed">
              {nodes.find((n) => n.id === selectedNodeId)?.description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-black/40 rounded border border-primary/10 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3 h-3 text-primary" />
          <span className="text-[8px] font-bold uppercase tracking-widest text-primary/60">
            Real-time State Transitions
          </span>
        </div>
        <div className="space-y-2">
          {transitions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between text-[8px] font-mono"
            >
              <div className="flex items-center gap-2">
                <span className="text-primary/40">
                  [{format(new Date(t.timestamp), 'HH:mm:ss')}]
                </span>
                <span className="text-primary font-bold">{t.from}</span>
                <ArrowRight className="w-2 h-2 text-primary/40" />
                <span className="text-primary font-bold">{t.to}</span>
              </div>
              <span
                className={`px-1 rounded ${
                  t.severity === 'high'
                    ? 'bg-red-500/20 text-red-500'
                    : t.severity === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-500'
                      : 'bg-primary/20 text-primary'
                }`}
              >
                {t.trigger.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [startupStep, setStartupStep] = useState(0);
  const [watchpoints, setWatchpoints] = useState<Watchpoint[]>(WATCHPOINTS);
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>(LEDGER_ITEMS);
  const [verdicts] = useState<Verdict[]>(VERDICTS);
  const [stats, setStats] = useState<OrderbookStats>(ORDERBOOK_STATS);
  const [exploits, setExploits] = useState<Exploit[]>([]);
  const [fuzzingTargets, setFuzzingTargets] =
    useState<FuzzingTarget[]>(FUZZING_TARGETS);
  const [bountyStats, setBountyStats] =
    useState<BugBountyStats>(BUG_BOUNTY_STATS);
  const [yieldStats, setYieldStats] = useState<YieldAggregator>(YIELD_STATS);
  const [rewardPools, setRewardPools] = useState<RewardPool[]>(REWARD_POOLS);
  const [securityModules, setSecurityModules] =
    useState<SecurityModule[]>(SECURITY_MODULES);
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    tps: 1420,
    gasPrice: '12 Gwei',
    activeNodes: 128,
    totalIntercepted: 12450,
    invariantsChecked: 890421,
  });
  const [anomalies, setAnomalies] = useState<AnomalyLog[]>(MOCK_ANOMALIES);
  const [stateNodes] = useState<StateMachineNode[]>(STATE_MACHINE_NODES);
  const [stateTransitions, setStateTransitions] =
    useState<StateTransition[]>(STATE_TRANSITIONS);
  const [threats] = useState<ThreatLocation[]>(THREAT_LOCATIONS);
  const [vaults] = useState<QuantumVault[]>(QUANTUM_VAULTS);
  const [leaks, setLeaks] = useState<DarknetLeak[]>(MOCK_LEAKS);
  const [zkProofs, setZkProofs] = useState<ZKProof[]>(MOCK_ZK_PROOFS);
  const [auditLogs, setAuditLogs] = useState<OperatorActivity[]>(
    MOCK_OPERATOR_ACTIVITY,
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [anomalySeverityFilter, setAnomalySeverityFilter] =
    useState<string>('all');
  const [anomalySourceFilter, setAnomalySourceFilter] = useState<string>('all');
  const [zkStatusFilter, setZkStatusFilter] = useState<string>('all');
  const [expandedZkProofIds, setExpandedZkProofIds] = useState<string[]>([]);
  const [auditFilter, setAuditFilter] = useState<'all' | 'flagged-blocked'>(
    'all',
  );
  const [auditVerifiedFilter, setAuditVerifiedFilter] = useState<
    'all' | 'verified' | 'unverified'
  >('all');
  const [expandedExploitIds, setExpandedExploitIds] = useState<string[]>([]);
  const [remediatedExploitIds, setRemediatedExploitIds] = useState<string[]>(
    [],
  );
  const [remediatingIds, setRemediatingIds] = useState<string[]>([]);
  const [auditDateStart, setAuditDateStart] = useState<string>('');
  const [auditDateEnd, setAuditDateEnd] = useState<string>('');

  // New States for requested features
  const [adaptiveResponseEnabled, setAdaptiveResponseEnabled] = useState(true);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditTimeFilter, setAuditTimeFilter] = useState<'all' | '1h' | '24h'>(
    'all',
  );
  const [encryptionActive, setEncryptionActive] = useState(true);
  const [encryptionKeyRotation, setEncryptionKeyRotation] = useState(0);

  // Decade Projection Data
  const [projectionData] = useState(
    Array.from({ length: 10 }, (_, i) => ({
      year: 2026 + i,
      yield: 3.15 + i * 2.2 + Math.random() * 2,
    })),
  );

  // Real-time simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new state transition
      const fromNodes = ['INGRESS', 'VERIFICATION', 'EXECUTION'];
      const toNodes = ['VERIFICATION', 'EXECUTION', 'SETTLEMENT'];
      const triggers = [
        'Packet Validated',
        'State Sync',
        'Finality Reached',
        'Auth Success',
      ];

      const newTransition: StateTransition = {
        id: `st-${Date.now()}`,
        from: fromNodes[Math.floor(Math.random() * fromNodes.length)],
        to: toNodes[Math.floor(Math.random() * toNodes.length)],
        timestamp: new Date().toISOString(),
        trigger: triggers[Math.floor(Math.random() * triggers.length)],
        severity: Math.random() > 0.8 ? 'medium' : 'low',
      };

      setStateTransitions((prev) => [newTransition, ...prev.slice(0, 4)]);

      // Simulate new ZK Proof
      if (Math.random() > 0.7) {
        const newProof: ZKProof = {
          id: `zk-${Date.now()}`,
          timestamp: new Date().toISOString(),
          proofHash: `0xZK${Math.random().toString(16).slice(2).toUpperCase()}${Math.random().toString(16).slice(2).toUpperCase()}`,
          circuit: [
            'AuthCircuit_v4',
            'StateTransition_v1',
            'LiquidityGuard_v2',
          ][Math.floor(Math.random() * 3)],
          status: Math.random() > 0.9 ? 'verifying' : 'valid',
          latency: Math.floor(Math.random() * 150) + 30,
        };
        setZkProofs((prev) => [newProof, ...prev.slice(0, 3)]);
      }

      // Simulate new Darknet Leak
      if (Math.random() > 0.95) {
        const newLeak: DarknetLeak = {
          id: `l-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: ['OnionScan', 'LeakBot', 'ShadowNet'][
            Math.floor(Math.random() * 3)
          ],
          leakType: ['credentials', 'exploit', 'intel'][
            Math.floor(Math.random() * 3)
          ] as any,
          content: 'New threat vector identified in encrypted channel',
          riskScore: Math.random() * 0.5 + 0.5,
        };
        setLeaks((prev) => [newLeak, ...prev.slice(0, 2)]);
      }

      // Simulate new Anomaly
      if (Math.random() > 0.8) {
        const sources = [
          'L3 Core',
          'Vault-Alpha',
          'Oracle-Node',
          'Sentinel-Gate',
        ];
        const messages = [
          'Unauthorized state access attempt',
          'Quantum decoherence spike detected',
          'Lattice invariant mismatch',
          'Suspicious biometric signature',
          'Protocol buffer overflow attempt',
        ];
        const severities: ('low' | 'medium' | 'high' | 'critical')[] = [
          'low',
          'medium',
          'high',
          'critical',
        ];

        const newAnomaly: AnomalyLog = {
          id: `an-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: sources[Math.floor(Math.random() * sources.length)],
          message: messages[Math.floor(Math.random() * messages.length)],
          severity:
            severities[
              Math.floor(Math.random() * (Math.random() > 0.9 ? 4 : 3))
            ],
          txHash:
            Math.random() > 0.5
              ? `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`
              : undefined,
        };
        setAnomalies((prev) => [newAnomaly, ...prev.slice(0, 10)]);
      }

      // Simulate new Audit Log
      if (Math.random() > 0.85) {
        const actions = [
          'Rebalance Liquidity Pool',
          'Update Oracle Parameters',
          'Rotate Security Keys',
          'Emergency Shutdown Initiated',
          'Vault Access Requested',
          'Invariant Check Triggered',
        ];
        const operators = [
          'Operator_0x44',
          'Operator_0x99',
          'Operator_0x21',
          'System_Admin',
        ];
        const statuses: ('authorized' | 'flagged' | 'blocked')[] = [
          'authorized',
          'authorized',
          'authorized',
          'flagged',
          'blocked',
        ];

        const newLog: OperatorActivity = {
          id: `op-${Date.now()}`,
          timestamp: new Date().toISOString(),
          operatorId: operators[Math.floor(Math.random() * operators.length)],
          action: actions[Math.floor(Math.random() * actions.length)],
          identityVerified: Math.random() > 0.1,
          status: statuses[Math.floor(Math.random() * statuses.length)],
        };
        setAuditLogs((prev) => [newLog, ...prev.slice(0, 8)]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Adaptive Response Logic
  useEffect(() => {
    if (!adaptiveResponseEnabled || anomalies.length === 0) return;

    const latestAnomaly = anomalies[0];
    if (
      latestAnomaly.severity === 'critical' ||
      latestAnomaly.severity === 'high'
    ) {
      // Auto-harden modules related to the anomaly source
      setSecurityModules((prev) =>
        prev.map((m) => {
          const isMatch = latestAnomaly.source
            .toLowerCase()
            .includes(m.name.toLowerCase().split(' ')[0].toLowerCase());
          if (isMatch || Math.random() > 0.7) {
            // Global hardening or specific
            return {
              ...m,
              status: 'active',
              quantumLoad: Math.min(1, m.quantumLoad + 0.1),
            };
          }
          return m;
        }),
      );
    }
  }, [anomalies, adaptiveResponseEnabled]);

  // Encryption Heatbeat
  useEffect(() => {
    if (!encryptionActive) return;
    const interval = setInterval(() => {
      setEncryptionKeyRotation((prev) => (prev + 1) % 100);
    }, 3000);
    return () => clearInterval(interval);
  }, [encryptionActive]);

  const [repoUrl, setRepoUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Startup sequence logic
  useEffect(() => {
    const sequence = async () => {
      await new Promise((r) => setTimeout(r, 1000));
      setStartupStep(1); // Lightning
      await new Promise((r) => setTimeout(r, 1000));
      setStartupStep(2); // Symbol
      await new Promise((r) => setTimeout(r, 1500));
      setStartupStep(3); // Eye opens
      await new Promise((r) => setTimeout(r, 1000));
      setStartupStep(4); // Lasers
      await new Promise((r) => setTimeout(r, 1500));
      setStartupStep(5); // City background + Logo
      await new Promise((r) => setTimeout(r, 2000));
      setShowDashboard(true);
    };
    sequence();
  }, []);

  // Real-time data simulation
  useEffect(() => {
    if (!showDashboard) return;

    const interval = setInterval(() => {
      // Update Watchpoints
      setWatchpoints((prev) =>
        prev.map((wp) => ({
          ...wp,
          trend: [
            ...wp.trend.slice(1),
            wp.trend[wp.trend.length - 1] + (Math.random() - 0.5) * 5,
          ],
        })),
      );

      // Update Ledger
      setLedgerItems((prev) =>
        prev.map((item) => ({
          ...item,
          trend: [
            ...item.trend.slice(1),
            item.trend[item.trend.length - 1] + (Math.random() - 0.5) * 2,
          ],
        })),
      );

      // Update Fuzzing
      setFuzzingTargets((prev) =>
        prev.map((target) => ({
          ...target,
          coverage:
            target.status === 'fuzzing'
              ? Math.min(100, target.coverage + Math.random() * 0.1)
              : target.coverage,
          crashes:
            target.status === 'fuzzing' && Math.random() > 0.99
              ? target.crashes + 1
              : target.crashes,
        })),
      );

      setCurrentTime(new Date());
      setNetworkStats((prev) => ({
        ...prev,
        tps: Math.floor(1400 + Math.random() * 100),
        totalIntercepted: prev.totalIntercepted + (Math.random() > 0.8 ? 1 : 0),
        invariantsChecked: prev.invariantsChecked + 152,
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [showDashboard]);

  const handleRepoScan = () => {
    if (!repoUrl) return;
    setIsScanning(true);
    setScanProgress(0);
    setExploits([]);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          setExploits(MOCK_EXPLOITS);
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  const handleMaximizeYield = () => {
    // Simulate signing and pushing yield to 25% with Quantum Power
    const target = 25.0;
    const duration = 3000; // 3 seconds for a more cinematic feel
    const steps = 60;
    const increment = (target - yieldStats.currentYield) / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      setYieldStats((prev) => ({
        ...prev,
        currentYield: Math.min(target, prev.currentYield + increment),
        bmnrPower: prev.bmnrPower + 0.8, // Increased power gain
      }));
      currentStep++;
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, duration / steps);
  };

  if (!showDashboard) {
    return (
      <div className="startup-container">
        <div
          className={`city-bg ${startupStep >= 5 ? 'opacity-50' : 'opacity-0'}`}
        />
        <div className="city-overlay" />

        <AnimatePresence>
          {startupStep === 1 && (
            <motion.div
              key="lightning"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0, 1, 0] }}
              className="lightning"
              style={{ left: '50%' }}
            />
          )}

          {startupStep >= 2 && startupStep < 5 && (
            <motion.div
              key="symbol"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="z-10"
            >
              <Shield className="w-32 h-32 text-primary glow-text-cyan" />
            </motion.div>
          )}

          {startupStep >= 3 && startupStep < 5 && (
            <motion.div
              key="eye"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="eye-container mt-8"
            >
              <motion.div
                className="eye-lid eye-lid-top"
                animate={{ top: startupStep >= 3 ? '-50%' : '0%' }}
                transition={{ duration: 0.5 }}
              />
              <motion.div
                className="eye-lid eye-lid-bottom"
                animate={{ bottom: startupStep >= 3 ? '-50%' : '0%' }}
                transition={{ duration: 0.5 }}
              />
              <div className="eye-iris">
                <div className="eye-pupil" />
              </div>

              {startupStep === 4 && (
                <>
                  <motion.div
                    className="laser"
                    initial={{ width: 0, rotate: -30 }}
                    animate={{ width: 1000 }}
                    style={{ left: '50%', top: '50%' }}
                  />
                  <motion.div
                    className="laser"
                    initial={{ width: 0, rotate: 30 }}
                    animate={{ width: 1000 }}
                    style={{ left: '50%', top: '50%' }}
                  />
                </>
              )}
            </motion.div>
          )}

          {startupStep >= 5 && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center z-10"
            >
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary blur-3xl opacity-20" />
                  <Shield className="w-24 h-24 text-primary relative" />
                </div>
              </div>
              <h1 className="font-mono font-bold text-4xl tracking-[0.5em] uppercase glow-text-cyan mb-2 glitch-text">
                AETHERON SENTINEL L3
              </h1>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.8em] text-primary/60">
                  INITIALIZING SOVEREIGN PROTOCOLS
                </p>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.4em] text-primary animate-pulse">
                  BMNR YIELD AGGREGATOR: ONLINE
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-foreground text-primary font-sans selection:bg-primary selection:text-primary-foreground overflow-hidden flex flex-col space-bg tron-grid">
      <div className="nebula opacity-30" />
      <div className="scanline" />

      {/* Header */}
      <header className="h-28 flex flex-col items-center justify-center px-6 z-50 relative header-glow bg-black/60 tron-border">
        <div className="flex items-center gap-8 w-full max-w-450">
          {/* Left Side: System Info */}
          <div className="hidden lg:flex flex-col gap-1 flex-1">
            <div className="flex items-center gap-2">
              <Radar className="w-3 h-3 text-primary animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-primary/80">
                Quantum Core: Active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-primary/80">
                Yield: {yieldStats.currentYield.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Center: Title */}
          <div className="text-center flex-1">
            <h1 className="font-sans font-black text-3xl tracking-[0.4em] uppercase glow-text-cyan mb-1">
              AETHERON SENTINEL
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-linear-to-r from-transparent to-primary/50" />
              <p className="text-[10px] font-bold uppercase tracking-[0.6em] text-primary/60">
                L7 QUANTUM SECURITY LAYER
              </p>
              <div className="h-px w-12 bg-linear-to-l from-transparent to-primary/50" />
            </div>
          </div>

          {/* Right Side: Repo Scanner Bar */}
          <div className="flex-1 flex justify-end">
            <div className="ufo-hud p-1 flex items-center gap-2 w-full max-w-md tron-border">
              <Search className="w-4 h-4 text-primary ml-2" />
              <Input
                placeholder="ENTER REPOSITORY URL FOR EXPLOIT SCAN..."
                className="bg-transparent border-none focus-visible:ring-0 text-[10px] font-mono uppercase tracking-widest h-8 placeholder:text-primary/30"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRepoScan()}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 text-primary"
                onClick={handleRepoScan}
                disabled={isScanning}
              >
                {isScanning ? 'SCANNING...' : 'EXECUTE'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 z-10 overflow-hidden technical-grid">
        <div className="max-w-450 mx-auto flex flex-col lg:grid lg:grid-cols-12 gap-6 h-full">
          {/* Left Column: Fuzzing & Bug Bounty */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* Bug Bounty Intelligence */}
            <Card className="console-panel military-panel p-4 tron-border">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-primary" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  Bounty Intelligence
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">
                    Total Earned
                  </p>
                  <p className="text-lg font-mono font-bold text-primary glow-text-cyan">
                    {bountyStats.totalEarned}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">
                    Global Rank
                  </p>
                  <p className="text-lg font-mono font-bold text-primary">
                    #{bountyStats.rank}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">
                    Vulns Found
                  </p>
                  <p className="text-lg font-mono font-bold text-primary">
                    {bountyStats.vulnerabilitiesFound}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">
                    Active Progs
                  </p>
                  <p className="text-lg font-mono font-bold text-primary">
                    {bountyStats.activePrograms}
                  </p>
                </div>
              </div>
            </Card>

            {/* Massive Yield Aggregator */}
            <Card className="console-panel p-4 tron-border bg-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
                  <span className="text-[6px] font-mono text-primary/40 uppercase">
                    Quantum Stabilizer: Active
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    Decade Yield Aggregator
                  </h2>
                </div>
                <Badge
                  variant="outline"
                  className="text-[8px] border-primary/50 text-primary animate-pulse"
                >
                  10Y PROJECTION ACTIVE
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest mb-1">
                      Current APY
                    </p>
                    <p className="text-3xl font-mono font-bold text-primary glow-text-cyan">
                      {yieldStats.currentYield.toFixed(2)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest mb-1">
                      10Y Peak Target
                    </p>
                    <p className="text-sm font-mono font-bold text-primary/60">
                      25.00%
                    </p>
                  </div>
                </div>

                {/* Yield Adjustment Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[7px] font-bold text-primary/40 uppercase tracking-widest">
                      Adjust Yield
                    </span>
                    <span className="text-[9px] font-mono text-primary">
                      {yieldStats.currentYield.toFixed(2)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="0.01"
                    title="Adjust current APY"
                    aria-label="Adjust current APY"
                    value={yieldStats.currentYield}
                    onChange={(e) =>
                      setYieldStats((prev) => ({
                        ...prev,
                        currentYield: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full h-1 bg-primary/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Decade Projection Chart */}
                <div className="h-20 w-full opacity-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionData}>
                      <defs>
                        <linearGradient
                          id="yieldGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#00f2ff"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#00f2ff"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="yield"
                        stroke="#00f2ff"
                        fillOpacity={1}
                        fill="url(#yieldGradient)"
                        strokeWidth={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-2 bg-primary/10 rounded-full overflow-hidden border border-primary/20">
                  <motion.div
                    className="h-full bg-primary shadow-[0_0_15px_rgba(0,242,255,0.8)]"
                    initial={{ width: '3.15%' }}
                    animate={{
                      width: `${(yieldStats.currentYield / 25) * 100}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-black/40 border border-primary/10">
                    <p className="text-[7px] font-bold text-primary/40 uppercase mb-1">
                      Quantum BMNR Power
                    </p>
                    <p className="text-xs font-mono font-bold text-primary">
                      {yieldStats.bmnrPower.toFixed(1)}x
                    </p>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-primary/10">
                    <p className="text-[7px] font-bold text-primary/40 uppercase mb-1">
                      Decade Lock-up
                    </p>
                    <p className="text-xs font-mono font-bold text-primary truncate">
                      SECURE [10Y]
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleMaximizeYield}
                  className="w-full bg-primary text-black font-bold uppercase tracking-widest text-[10px] h-10 hover:bg-primary/80 shadow-[0_0_20px_rgba(0,242,255,0.4)]"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  INITIATE 10Y QUANTUM YIELD
                </Button>
              </div>
            </Card>

            {/* Reward System */}
            <Card className="console-panel p-4 tron-border">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-4 h-4 text-primary" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  Reward Protocols
                </h2>
              </div>
              <div className="space-y-3">
                {rewardPools.map((pool) => (
                  <div
                    key={pool.id}
                    className="p-2 rounded border border-primary/10 bg-black/20 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-[9px] font-bold text-primary/80 uppercase">
                        {pool.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-mono text-primary/40">
                          {pool.multiplier}
                        </span>
                        {pool.status === 'boosting' && (
                          <span className="flex items-center text-[7px] text-orange-500 font-bold uppercase">
                            <Flame className="w-2 h-2 mr-1" /> Boosting
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold text-primary">
                        {pool.apr}%
                      </p>
                      <p className="text-[7px] text-primary/40 uppercase">
                        APR
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Fuzzing & Bug Finding */}
            <Card className="console-panel flex-1 flex flex-col overflow-hidden tron-border">
              <CardHeader className="py-3 border-b border-primary/10 flex flex-row items-center gap-2">
                <Bug className="w-3 h-3 text-primary" />
                <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em]">
                  Quantum Fuzzing Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 overflow-y-auto custom-scrollbar min-h-125">
                {fuzzingTargets.map((target) => (
                  <div
                    key={target.id}
                    className="space-y-2 p-3 rounded bg-primary/5 border border-primary/10 hover:border-primary/30 transition-all tron-border"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-primary truncate w-40">
                        {target.target}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[8px] font-mono ${target.status === 'fuzzing' ? 'text-primary border-primary/50 animate-pulse' : 'text-primary/60 border-primary/20'}`}
                      >
                        {target.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="fuzzing-bar">
                      {target.status === 'fuzzing' && (
                        <div className="fuzzing-bar-inner" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[8px] font-mono text-primary/40">
                      <span>
                        Crashes:{' '}
                        <span
                          className={
                            target.crashes > 0
                              ? 'text-red-500 glow-text-red'
                              : ''
                          }
                        >
                          {target.crashes}
                        </span>
                      </span>
                      <span>Coverage: {target.coverage.toFixed(2)}%</span>
                      <span>{target.runtime}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quantum Threat Intelligence Feed */}
            <Card className="console-panel h-48 p-4 tron-border">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-3 h-3 text-primary" />
                <h2 className="text-[9px] font-bold uppercase tracking-[0.2em]">
                  Threat Intelligence
                </h2>
              </div>
              <div className="space-y-2">
                {[
                  {
                    label: 'DDoS Vector',
                    status: 'Mitigated',
                    origin: 'RU-NET',
                  },
                  {
                    label: 'Zero-Day Attempt',
                    status: 'Blocked',
                    origin: 'CN-GW',
                  },
                  { label: 'SQLi Probe', status: 'Logged', origin: 'US-EAST' },
                ].map((threat, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[8px] font-mono border-b border-primary/5 pb-1"
                  >
                    <span className="text-primary/60">{threat.label}</span>
                    <div className="flex gap-2">
                      <span className="text-primary">{threat.status}</span>
                      <span className="text-primary/30">[{threat.origin}]</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Center Column: Command Center & Analysis */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
            {/* Responsive Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Network TPS', value: networkStats.tps, icon: Zap },
                {
                  label: 'Gas Price',
                  value: networkStats.gasPrice,
                  icon: Flame,
                },
                {
                  label: 'Active Nodes',
                  value: networkStats.activeNodes,
                  icon: Activity,
                },
                {
                  label: 'Intercepted',
                  value: networkStats.totalIntercepted,
                  icon: ShieldAlert,
                },
              ].map((stat, i) => (
                <Card
                  key={i}
                  className="console-panel p-3 border-primary/20 bg-primary/5 hover:border-primary/40 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className="w-3 h-3 text-primary/60" />
                    <span className="text-[7px] font-bold text-primary/40 uppercase tracking-widest">
                      {stat.label}
                    </span>
                  </div>
                  <div className="text-sm font-mono font-bold text-primary">
                    {stat.value}
                  </div>
                </Card>
              ))}
            </div>

            {/* Global Threat Radar */}
            <Card className="console-panel p-4 tron-border bg-black/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    Global Command HUD
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[8px] font-mono text-red-500 uppercase">
                      Active Threats: {threats.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[8px] font-mono text-primary uppercase">
                      Sentinel Nodes: 128
                    </span>
                  </div>
                </div>
              </div>
              <GlobalThreatMap threats={threats} />
            </Card>

            {/* State Machine HUD */}
            <Card className="console-panel p-4 tron-border">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-primary" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  Autonomous State Machine
                </h2>
              </div>
              <StateMachineHUD
                nodes={stateNodes}
                transitions={stateTransitions}
                onNodeClick={(id) =>
                  setSelectedNodeId(id === selectedNodeId ? null : id)
                }
                selectedNodeId={selectedNodeId}
              />
            </Card>

            {/* Scan Results / Exploit Feed */}
            <Card className="console-panel flex-1 flex flex-col overflow-hidden relative tron-border">
              <AnimatePresence>
                {isScanning && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-6"
                  >
                    <div className="quantum-core">
                      <motion.div
                        className="quantum-ring w-full h-full"
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      />
                      <motion.div
                        className="quantum-ring w-[80%] h-[80%] [animation-direction:reverse]"
                        animate={{ rotate: -360 }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      />
                      <motion.div
                        className="quantum-ring w-[60%] h-[60%]"
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      />
                      <QuantumIcon className="w-12 h-12 text-primary animate-pulse" />
                    </div>
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-[10px] font-mono font-bold tracking-[0.4em] text-primary">
                        <span>ANALYZING...</span>
                        <span>{scanProgress}%</span>
                      </div>
                      <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${scanProgress}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] font-mono text-primary/40 animate-pulse uppercase tracking-[0.2em]">
                      DECONSTRUCTING SMART CONTRACT BYTECODE...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <CardHeader className="py-3 border-b border-primary/10 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-primary" />
                  <CardTitle className="text-xs font-bold uppercase tracking-[0.3em]">
                    Exploit Vector Analysis
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {exploits.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExploits([])}
                        className="h-6 text-[8px] font-bold uppercase tracking-widest text-red-500/60 hover:text-red-500 hover:bg-red-500/10 border border-red-500/20"
                      >
                        CLEAR ALL
                      </Button>
                      <Badge
                        variant="destructive"
                        className="text-[10px] font-mono animate-pulse bg-red-500/20 text-red-500 border-red-500/50"
                      >
                        {exploits.length} VULNERABILITIES DETECTED
                      </Badge>
                    </>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                {exploits.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exploits.map((exploit) => (
                      <div
                        key={exploit.id}
                        className={`p-4 rounded border bg-primary/5 transition-all hover:scale-[1.02] tron-border ${
                          exploit.severity === 'critical'
                            ? 'border-red-500/50 critical-pulse'
                            : 'border-primary/10'
                        } ${remediatedExploitIds.includes(exploit.id) ? 'opacity-50 grayscale' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${
                                exploit.severity === 'critical'
                                  ? 'bg-red-500'
                                  : exploit.severity === 'high'
                                    ? 'bg-primary'
                                    : 'bg-primary/40'
                              } text-[8px] font-bold font-mono`}
                            >
                              {exploit.severity.toUpperCase()}
                            </Badge>
                            {exploit.remediationScript && (
                              <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5">
                                <span
                                  className={`text-[7px] font-bold uppercase tracking-widest ${
                                    remediatingIds.includes(exploit.id)
                                      ? 'text-yellow-500 animate-pulse'
                                      : remediatedExploitIds.includes(
                                            exploit.id,
                                          )
                                        ? 'text-green-500'
                                        : 'text-primary/60'
                                  }`}
                                >
                                  {remediatingIds.includes(exploit.id)
                                    ? 'Remediating...'
                                    : remediatedExploitIds.includes(exploit.id)
                                      ? 'Remediated'
                                      : 'Script Available'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <h3 className="text-sm font-bold uppercase tracking-tight mb-2 text-primary flex items-center gap-2">
                          {exploit.title}
                          {remediatedExploitIds.includes(exploit.id) && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" />
                          )}
                        </h3>

                        <AnimatePresence>
                          {expandedExploitIds.includes(exploit.id) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="flex items-center gap-2 mb-2 p-1 border-b border-primary/5">
                                <span className="text-[9px] font-mono text-primary/60">
                                  FILE: {exploit.file}
                                </span>
                                <span className="text-[9px] font-mono text-primary/60">
                                  LINE: {exploit.line}
                                </span>
                              </div>
                              <p className="text-[10px] text-primary/60 leading-relaxed font-mono uppercase tracking-wider mb-2">
                                {exploit.description}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex items-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setExpandedExploitIds((prev) =>
                                prev.includes(exploit.id)
                                  ? prev.filter((id) => id !== exploit.id)
                                  : [...prev, exploit.id],
                              )
                            }
                            className="flex-1 h-8 text-[9px] font-bold uppercase tracking-widest border-primary/20 hover:bg-primary/20 text-primary"
                          >
                            {expandedExploitIds.includes(exploit.id)
                              ? 'HIDE DETAILS'
                              : 'VIEW DETAILS'}
                          </Button>
                          <Button
                            disabled={
                              remediatedExploitIds.includes(exploit.id) ||
                              remediatingIds.includes(exploit.id)
                            }
                            onClick={() => {
                              if (exploit.remediationScript) {
                                setRemediatingIds((prev) => [
                                  ...prev,
                                  exploit.id,
                                ]);
                                setTimeout(() => {
                                  setRemediatingIds((prev) =>
                                    prev.filter((id) => id !== exploit.id),
                                  );
                                  setRemediatedExploitIds((prev) => [
                                    ...prev,
                                    exploit.id,
                                  ]);
                                }, 2000);
                              }
                            }}
                            className={`flex-1 h-8 text-[9px] font-bold uppercase tracking-widest ${
                              exploit.remediationScript
                                ? 'bg-primary text-black hover:bg-primary/80'
                                : 'bg-primary/20 text-primary/40 cursor-not-allowed'
                            }`}
                          >
                            <Zap
                              className={`w-3 h-3 mr-1 ${exploit.remediationScript && !remediatedExploitIds.includes(exploit.id) ? 'animate-pulse' : ''}`}
                            />
                            {remediatingIds.includes(exploit.id)
                              ? 'EXECUTING...'
                              : remediatedExploitIds.includes(exploit.id)
                                ? 'REMEDIATED'
                                : exploit.remediationScript
                                  ? 'RUN REMEDIATION'
                                  : 'NO SCRIPT'}
                          </Button>
                        </div>
                        {remediatingIds.includes(exploit.id) && (
                          <div className="mt-2 flex items-center gap-2">
                            <RefreshCw className="w-2 h-2 text-primary animate-spin" />
                            <span className="text-[7px] font-mono text-primary uppercase tracking-widest">
                              Running {exploit.remediationScript}...
                            </span>
                          </div>
                        )}
                        {remediatedExploitIds.includes(exploit.id) && (
                          <div className="mt-2 flex items-center gap-2">
                            <CheckCircle2 className="w-2 h-2 text-green-500" />
                            <span className="text-[7px] font-mono text-green-500 uppercase tracking-widest">
                              Vulnerability Patched
                            </span>
                          </div>
                        )}
                        {exploit.remediationScript &&
                          !remediatedExploitIds.includes(exploit.id) && (
                            <p className="mt-2 text-[7px] font-mono text-green-500/60 uppercase tracking-widest">
                              Suggested: {exploit.remediationScript}
                            </p>
                          )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <Eye className="w-16 h-16 text-primary/20" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-[0.2em]">
                        No Active Scan
                      </p>
                      <p className="text-[10px] font-mono uppercase tracking-widest">
                        Enter a repository URL to begin exploit discovery
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Modules */}
            <Card className="console-panel p-4 tron-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    Quantum Security Modules
                  </h2>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-primary/5 rounded border border-primary/10">
                  <span className="text-[7px] font-bold text-primary/40 uppercase tracking-widest">
                    Adaptive Response
                  </span>
                  <button
                    title="Toggle adaptive response"
                    aria-label="Toggle adaptive response"
                    onClick={() =>
                      setAdaptiveResponseEnabled(!adaptiveResponseEnabled)
                    }
                    className={`h-4 w-8 rounded-full relative transition-colors ${adaptiveResponseEnabled ? 'bg-primary' : 'bg-primary/20'}`}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-3 h-3 bg-black rounded-full shadow-lg"
                      animate={{ x: adaptiveResponseEnabled ? 16 : 0 }}
                    />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {securityModules.map((module) => (
                  <motion.div
                    key={module.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 rounded border border-primary/10 bg-primary/5 flex flex-col gap-2 relative group overflow-hidden"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={module.status}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="absolute inset-0 bg-primary/5 pointer-events-none"
                      />
                    </AnimatePresence>
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-[9px] font-bold text-primary uppercase tracking-widest">
                        {module.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[6px] border-primary/20 text-primary/40 font-mono"
                        >
                          LOAD: {Math.round(module.quantumLoad * 100)}%
                        </Badge>
                        <motion.div
                          key={module.status}
                          initial={{
                            scale: 0.9,
                            opacity: 0,
                            filter: 'blur(4px)',
                          }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            filter: 'blur(0px)',
                            boxShadow:
                              module.status === 'active'
                                ? '0 0 10px rgba(0, 242, 255, 0.3)'
                                : '0 0 10px rgba(234, 179, 8, 0.3)',
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 25,
                            opacity: { duration: 0.2 },
                          }}
                        >
                          <Badge
                            variant="outline"
                            className={`text-[7px] border-primary/30 transition-colors duration-300 ${module.status === 'active' ? 'text-primary border-primary/40' : module.status === 'paused' ? 'text-yellow-500 border-yellow-500/40' : 'text-red-500 border-red-500/40'}`}
                          >
                            {module.status.toUpperCase()}
                          </Badge>
                        </motion.div>
                      </div>
                    </div>
                    <div className="h-1 bg-primary/5 rounded-full overflow-hidden relative z-10">
                      <motion.div
                        className="h-full bg-primary/40"
                        initial={{ width: 0 }}
                        animate={{ width: `${module.quantumLoad * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-primary/5 relative z-10">
                      <p className="text-[8px] text-primary/40 font-mono truncate">
                        {module.address}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-2 text-[7px] font-bold uppercase tracking-widest border border-primary/10 hover:bg-primary/20 ${module.status === 'active' ? 'text-primary' : 'text-yellow-500'}`}
                        onClick={() => {
                          setSecurityModules((prev) =>
                            prev.map((m) =>
                              m.id === module.id
                                ? {
                                    ...m,
                                    status:
                                      m.status === 'active'
                                        ? 'paused'
                                        : 'active',
                                  }
                                : m,
                            ),
                          );
                        }}
                      >
                        {module.status === 'active' ? (
                          <Pause className="w-2.5 h-2.5 mr-1" />
                        ) : (
                          <Play className="w-2.5 h-2.5 mr-1" />
                        )}
                        {module.status === 'active' ? 'PAUSE' : 'ACTIVATE'}
                      </Button>
                    </div>
                    <p className="text-[8px] text-primary/60 leading-tight uppercase tracking-wider relative z-10 mt-1">
                      {module.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </Card>

            {/* Reorganized Middle Grid: Anomaly/Audit on Left, Pulse/Map on Right */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-6">
                {/* Anomaly Feed */}
                <Card className="console-panel flex-1 flex flex-col overflow-hidden tron-border">
                  <CardHeader className="py-3 border-b border-primary/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-500">
                          Anomaly Feed
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAnomalySeverityFilter('all');
                            setAnomalySourceFilter('all');
                          }}
                          className="h-5 text-[7px] font-bold uppercase tracking-widest text-primary/40 hover:text-primary"
                        >
                          RESET
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[6px] font-bold text-primary/30 uppercase tracking-widest">
                          Severity
                        </span>
                        <div className="flex gap-1">
                          {['all', 'critical', 'high', 'medium', 'low'].map(
                            (s) => (
                              <button
                                key={s}
                                onClick={() => setAnomalySeverityFilter(s)}
                                className={`px-1.5 py-0.5 rounded text-[6px] font-bold uppercase tracking-widest border transition-all ${
                                  anomalySeverityFilter === s
                                    ? 'bg-red-500/20 border-red-500 text-red-500'
                                    : 'border-primary/10 text-primary/40 hover:border-primary/30'
                                }`}
                              >
                                {s}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ScrollArea className="h-50">
                      <div className="space-y-3">
                        {anomalies
                          .filter(
                            (a) =>
                              anomalySeverityFilter === 'all' ||
                              a.severity === anomalySeverityFilter,
                          )
                          .filter(
                            (a) =>
                              anomalySourceFilter === 'all' ||
                              a.source === anomalySourceFilter,
                          )
                          .map((anomaly) => (
                            <div
                              key={anomaly.id}
                              className={`p-2 rounded border bg-red-500/5 transition-all ${
                                anomaly.severity === 'critical'
                                  ? 'border-red-500 animate-pulse'
                                  : anomaly.severity === 'high'
                                    ? 'border-red-500/50'
                                    : 'border-red-500/20'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[8px] font-bold text-red-500 uppercase tracking-widest">
                                  {anomaly.source}
                                </span>
                                <span className="text-[7px] font-mono text-red-500/60">
                                  {format(
                                    new Date(anomaly.timestamp),
                                    'HH:mm:ss',
                                  )}
                                </span>
                              </div>
                              <p className="text-[9px] font-bold text-red-500/80 uppercase tracking-tight leading-tight mb-1">
                                {anomaly.message}
                              </p>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Audit Log */}
                <Card className="console-panel flex-1 flex flex-col overflow-hidden tron-border">
                  <CardHeader className="py-3 border-b border-primary/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-3 h-3 text-primary" />
                        <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em]">
                          Operator Audit Log
                        </CardTitle>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex items-center gap-1">
                          <button
                            title="Reset audit filters"
                            aria-label="Reset audit filters"
                            onClick={() => {
                              setAuditFilter('all');
                              setAuditVerifiedFilter('all');
                              setAuditActionFilter('all');
                              setAuditTimeFilter('all');
                              setAuditDateStart('');
                              setAuditDateEnd('');
                            }}
                            className={`px-1.5 py-0.5 rounded text-[6px] font-bold uppercase tracking-widest border transition-all ${
                              auditFilter === 'all' &&
                              auditVerifiedFilter === 'all' &&
                              auditActionFilter === 'all' &&
                              auditTimeFilter === 'all' &&
                              !auditDateStart &&
                              !auditDateEnd
                                ? 'bg-primary/20 border-primary text-primary'
                                : 'border-primary/10 text-primary/40 hover:border-primary/30'
                            }`}
                          >
                            RESET
                          </button>
                          <select
                            title="Filter audit by action"
                            aria-label="Filter audit by action"
                            value={auditActionFilter}
                            onChange={(e) =>
                              setAuditActionFilter(e.target.value)
                            }
                            className="bg-black/40 border border-primary/10 rounded text-[6px] font-bold text-primary uppercase p-0.5 outline-none focus:border-primary"
                          >
                            <option value="all">ANY ACTION</option>
                            <option value="rebalance">REBALANCE</option>
                            <option value="oracle">ORACLE</option>
                            <option value="vault">VAULT</option>
                            <option value="emergency">EMERGENCY</option>
                          </select>
                          <select
                            title="Filter audit by time range"
                            aria-label="Filter audit by time range"
                            value={auditTimeFilter}
                            onChange={(e) =>
                              setAuditTimeFilter(e.target.value as any)
                            }
                            className="bg-black/40 border border-primary/10 rounded text-[6px] font-bold text-primary uppercase p-0.5 outline-none focus:border-primary"
                          >
                            <option value="all">ALL TIME</option>
                            <option value="1h">LAST HOUR</option>
                            <option value="24h">LAST 24H</option>
                          </select>
                          <div className="flex items-center gap-1 border border-primary/10 rounded bg-black/40 px-1">
                            <input
                              type="date"
                              title="Audit start date"
                              aria-label="Audit start date"
                              value={auditDateStart}
                              onChange={(e) =>
                                setAuditDateStart(e.target.value)
                              }
                              className="bg-transparent text-[6px] font-bold text-primary uppercase outline-none w-16"
                            />
                            <span className="text-[6px] text-primary/40">
                              -
                            </span>
                            <input
                              type="date"
                              title="Audit end date"
                              aria-label="Audit end date"
                              value={auditDateEnd}
                              onChange={(e) => setAuditDateEnd(e.target.value)}
                              className="bg-transparent text-[6px] font-bold text-primary uppercase outline-none w-16"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              setAuditFilter((prev) =>
                                prev === 'flagged-blocked'
                                  ? 'all'
                                  : 'flagged-blocked',
                              )
                            }
                            className={`px-1.5 py-0.5 rounded text-[6px] font-bold uppercase tracking-widest border transition-all ${
                              auditFilter === 'flagged-blocked'
                                ? 'bg-red-500/20 border-red-500 text-red-500'
                                : 'border-primary/10 text-primary/40 hover:border-primary/30'
                            }`}
                          >
                            THREATS
                          </button>
                          <button
                            onClick={() =>
                              setAuditVerifiedFilter((prev) =>
                                prev === 'verified' ? 'all' : 'verified',
                              )
                            }
                            className={`px-1.5 py-0.5 rounded text-[6px] font-bold uppercase tracking-widest border transition-all ${
                              auditVerifiedFilter === 'verified'
                                ? 'bg-green-500/20 border-green-500 text-green-500'
                                : 'border-primary/10 text-primary/40 hover:border-primary/30'
                            }`}
                          >
                            VERIFIED
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ScrollArea className="h-50">
                      <div className="space-y-3">
                        {auditLogs
                          .filter(
                            (log) =>
                              auditFilter === 'all' ||
                              log.status === 'flagged' ||
                              log.status === 'blocked',
                          )
                          .filter((log) => {
                            if (auditVerifiedFilter === 'all') return true;
                            if (auditVerifiedFilter === 'verified')
                              return log.identityVerified;
                            return !log.identityVerified;
                          })
                          .filter((log) => {
                            if (auditActionFilter === 'all') return true;
                            return log.action
                              .toLowerCase()
                              .includes(auditActionFilter);
                          })
                          .filter((log) => {
                            const logDate = new Date(log.timestamp);
                            const now = new Date();
                            const diff = now.getTime() - logDate.getTime();

                            // Date Range Logic
                            const start = auditDateStart
                              ? new Date(auditDateStart)
                              : null;
                            const end = auditDateEnd
                              ? new Date(auditDateEnd)
                              : null;
                            if (start && logDate < start) return false;
                            if (end) {
                              const endDay = new Date(end);
                              endDay.setHours(23, 59, 59, 999);
                              if (logDate > endDay) return false;
                            }

                            if (auditTimeFilter === 'all') return true;
                            if (auditTimeFilter === '1h')
                              return diff < 1000 * 60 * 60;
                            if (auditTimeFilter === '24h')
                              return diff < 1000 * 60 * 60 * 24;
                            return true;
                          })
                          .map((log) => (
                            <div
                              key={log.id}
                              className={`p-2 rounded border transition-all ${
                                log.status === 'authorized'
                                  ? 'border-primary/10 bg-primary/5 hover:bg-primary/10'
                                  : log.status === 'flagged'
                                    ? 'border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10'
                                    : 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[8px] font-bold uppercase tracking-widest ${
                                      log.status === 'authorized'
                                        ? 'text-primary'
                                        : log.status === 'flagged'
                                          ? 'text-yellow-500'
                                          : 'text-red-500'
                                    }`}
                                  >
                                    {log.operatorId}
                                  </span>
                                  {log.identityVerified && (
                                    <UserCheck
                                      className={`w-2 h-2 ${log.status === 'authorized' ? 'text-green-500' : 'text-primary/40'}`}
                                    />
                                  )}
                                </div>
                                <span className="text-[7px] font-mono text-primary/40">
                                  {format(new Date(log.timestamp), 'HH:mm:ss')}
                                </span>
                              </div>
                              <p
                                className={`text-[9px] font-mono mb-1 ${
                                  log.status === 'authorized'
                                    ? 'text-primary/80'
                                    : 'text-white'
                                }`}
                              >
                                {log.action}
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      log.status === 'authorized'
                                        ? 'bg-green-500'
                                        : log.status === 'flagged'
                                          ? 'bg-yellow-500'
                                          : 'bg-red-500'
                                    }`}
                                  />
                                  <Badge
                                    variant="outline"
                                    className={`text-[6px] px-1 py-0 h-3 border-primary/20 ${
                                      log.status === 'authorized'
                                        ? 'text-green-500'
                                        : log.status === 'flagged'
                                          ? 'text-yellow-500'
                                          : 'text-red-500'
                                    }`}
                                  >
                                    {log.status.toUpperCase()}
                                  </Badge>
                                </div>
                                {log.status !== 'authorized' && (
                                  <ShieldAlert className="w-2 h-2 text-red-500 animate-pulse" />
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-6">
                {/* Real-time Network Pulse */}
                <Card className="console-panel h-48 p-6 flex flex-col justify-between tron-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                        Quantum Network Pulse
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">
                          TPS
                        </p>
                        <p className="text-xs font-mono font-bold text-primary glow-text-cyan">
                          1,420.5
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">
                          LATENCY
                        </p>
                        <p className="text-xs font-mono font-bold text-primary glow-text-cyan">
                          12ms
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ORDERBOOK_DATA}>
                        <Area
                          type="monotone"
                          dataKey="bid"
                          stroke="#00f2ff"
                          fill="rgba(0, 242, 255, 0.1)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* NEW: Vulnerability Attack Surface Map */}
                <Card className="console-panel flex-1 p-4 tron-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Radar className="w-4 h-4 text-primary" />
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                      Attack Surface Map
                    </h2>
                  </div>
                  <div className="grid grid-cols-8 gap-2 h-32">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className={`rounded-sm border ${Math.random() > 0.8 ? 'bg-red-500/40 border-red-500/60 animate-pulse' : 'bg-primary/10 border-primary/20'}`}
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{
                          duration: 2 + Math.random() * 2,
                          repeat: Infinity,
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[8px] font-mono text-primary/40 uppercase tracking-widest">
                    <span>Total Nodes: 32</span>
                    <span className="text-red-500 glow-text-red">
                      Exposed: 4
                    </span>
                  </div>
                </Card>
              </div>
            </div>
          </div>

          {/* Right Column: Watchpoints & Verdicts */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
            {/* Autonomous Incident Response (AIR) */}
            <Card className="console-panel p-4 tron-border bg-primary/5">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-primary" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  Autonomous Response (AIR)
                </h2>
              </div>
              <div className="space-y-3">
                <div className="p-2 rounded bg-black/40 border border-primary/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 text-primary animate-spin-slow" />
                    <span className="text-[9px] font-bold text-primary uppercase">
                      Counter-Patch Engine
                    </span>
                  </div>
                  <Badge className="bg-primary text-black text-[7px]">
                    READY
                  </Badge>
                </div>
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    <span className="text-[9px] font-bold text-red-500 uppercase">
                      Emergency Kill-Switch
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-6 text-[7px] font-bold uppercase"
                  >
                    ARMED
                  </Button>
                </div>
              </div>
            </Card>

            {/* Quantum Vault Security */}
            <Card className="console-panel p-4 tron-border bg-primary/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    Quantum Vault Security
                  </h2>
                </div>
                {/* E2E Encryption Status Toggle */}
                <div className="flex items-center gap-2 px-2 py-1 bg-primary/5 rounded border border-primary/10">
                  <ShieldCheck
                    className={`w-3 h-3 ${encryptionActive ? 'text-green-500' : 'text-primary/20'}`}
                  />
                  <button
                    title="Toggle end-to-end encryption"
                    aria-label="Toggle end-to-end encryption"
                    onClick={() => setEncryptionActive(!encryptionActive)}
                    className={`h-4 w-8 rounded-full relative transition-colors ${encryptionActive ? 'bg-green-500' : 'bg-primary/20'}`}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full"
                      animate={{ x: encryptionActive ? 16 : 0 }}
                    />
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                {encryptionActive && (
                  <div className="p-2 rounded bg-green-500/5 border border-green-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw
                        className={`w-3 h-3 text-green-500 ${encryptionKeyRotation > 0 ? 'animate-spin' : ''}`}
                      />
                      <span className="text-[7px] font-mono text-green-500 uppercase font-bold tracking-[0.2em]">
                        E2E Rotation: Active
                      </span>
                    </div>
                  </div>
                )}
                {vaults.map((vault) => (
                  <div
                    key={vault.id}
                    className="space-y-3 p-3 rounded border border-primary/10 bg-black/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                          {vault.name}
                        </span>
                        <span className="text-[7px] font-mono text-primary/40 uppercase">
                          Sync: {format(new Date(vault.lastSync), 'HH:mm:ss')}
                        </span>
                      </div>
                      <Badge
                        className={`${
                          vault.status === 'locked'
                            ? 'bg-primary text-black'
                            : vault.status === 'processing'
                              ? 'bg-yellow-500 text-black animate-pulse'
                              : 'bg-green-500 text-black'
                        } text-[8px] font-bold font-mono px-2 py-0.5`}
                      >
                        {vault.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      {/* Entropy Level */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-mono text-primary/60 uppercase">
                          <span>Entropy Level</span>
                          <span className="text-primary">
                            {Math.round(vault.entropyLevel * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden border border-primary/5">
                          <motion.div
                            className="h-full bg-primary shadow-[0_0_10px_rgba(0,242,255,0.5)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${vault.entropyLevel * 100}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      {/* Quantum Metrics Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[7px] font-bold text-primary/40 uppercase tracking-widest">
                            Qubit Stability
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-primary/5 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-primary/60"
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${vault.qubitStability * 100}%`,
                                }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-primary">
                              {Math.round(vault.qubitStability * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[7px] font-bold text-primary/40 uppercase tracking-widest">
                            Decoherence Rate
                          </p>
                          <p className="text-[9px] font-mono text-primary">
                            {vault.decoherenceRate.toFixed(4)}{' '}
                            <span className="text-[7px] text-primary/40">
                              ms⁻¹
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-primary/5">
                        <span className="text-[7px] font-mono text-primary/30 uppercase">
                          Capacity: {vault.capacity}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
                          <span className="text-[7px] font-mono text-primary/60 uppercase">
                            Live Stream
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* ZK Proof Validator */}
            <Card className="console-panel p-4 tron-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    ZK Proof Validator
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <ListFilter className="w-3 h-3 text-primary/40 mr-1" />
                  {['all', 'valid', 'verifying', 'invalid'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setZkStatusFilter(s)}
                      className={`px-1.5 py-0.5 rounded text-[6px] font-bold uppercase tracking-widest border transition-all ${
                        zkStatusFilter === s
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'border-primary/10 text-primary/40 hover:border-primary/30'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {zkProofs
                  .filter(
                    (p) =>
                      zkStatusFilter === 'all' || p.status === zkStatusFilter,
                  )
                  .map((proof) => (
                    <div
                      key={proof.id}
                      className="flex flex-col gap-2 p-2 rounded bg-primary/5 border border-primary/10 transition-all hover:bg-primary/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col overflow-x-hidden">
                          <span className="text-[8px] font-mono text-primary/40 uppercase tracking-widest mb-0.5">
                            Circuit: {proof.circuit}
                          </span>
                          <span className="text-[7px] font-mono text-primary/20">
                            {format(new Date(proof.timestamp), 'HH:mm:ss')}
                          </span>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div className="flex flex-col items-end">
                            <Badge
                              variant="outline"
                              className={`text-[7px] border-primary/20 ${
                                proof.status === 'valid'
                                  ? 'text-primary'
                                  : proof.status === 'verifying'
                                    ? 'text-yellow-500'
                                    : 'text-red-500'
                              }`}
                            >
                              {proof.status.toUpperCase()}
                            </Badge>
                            <p className="text-[7px] font-mono text-primary/40 mt-1">
                              {proof.latency}ms
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setExpandedZkProofIds((prev) =>
                                prev.includes(proof.id)
                                  ? prev.filter((id) => id !== proof.id)
                                  : [...prev, proof.id],
                              )
                            }
                            className="h-7 px-2 text-[7px] font-bold uppercase tracking-widest border-primary/20 hover:bg-primary/20 text-primary"
                          >
                            {expandedZkProofIds.includes(proof.id)
                              ? 'HIDE DETAILS'
                              : 'VIEW PROOF DETAILS'}
                          </Button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expandedZkProofIds.includes(proof.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-black/40 rounded p-2 mt-1 border border-primary/5"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="text-[7px] font-bold text-primary uppercase tracking-[0.2em] mb-1">
                                Full Proof Hash
                              </span>
                              <span className="text-[8px] font-mono text-primary break-all leading-tight">
                                {proof.proofHash}
                              </span>
                              <div className="mt-2 pt-2 border-t border-primary/5 flex justify-between items-center">
                                <span className="text-[7px] font-mono text-primary/40 uppercase">
                                  Circuit Topology: Quant-Flow-v
                                  {proof.id.slice(-1)}
                                </span>
                                <Badge className="bg-primary/10 text-primary text-[6px] border border-primary/20">
                                  VERIFIED BY SENTINEL
                                </Badge>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                {zkProofs.filter(
                  (p) =>
                    zkStatusFilter === 'all' || p.status === zkStatusFilter,
                ).length === 0 && (
                  <div className="text-center py-4 opacity-40">
                    <p className="text-[8px] font-mono uppercase tracking-widest">
                      No proofs found for status: {zkStatusFilter}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Darknet Intelligence */}
            <Card className="console-panel p-4 tron-border bg-black/40">
              <div className="flex items-center gap-2 mb-4">
                <Ghost className="w-4 h-4 text-primary" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  Darknet Intelligence
                </h2>
              </div>
              <div className="space-y-3">
                {leaks.map((leak) => (
                  <div
                    key={leak.id}
                    className="p-2 rounded border border-primary/10 bg-primary/5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-primary/60 uppercase">
                          {leak.source}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[6px] border-primary/20 text-primary/40 px-1 py-0 h-3"
                        >
                          {leak.leakType.toUpperCase()}
                        </Badge>
                      </div>
                      <span className="text-[7px] font-mono text-primary/40">
                        {format(new Date(leak.timestamp), 'HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-[9px] text-primary leading-tight mb-2">
                      {leak.content}
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[7px] font-bold text-red-500 uppercase tracking-widest">
                          Risk Score
                        </span>
                        <span className="text-[7px] font-bold text-red-500">
                          {Math.round(leak.riskScore * 100)}%
                        </span>
                      </div>
                      <div className="h-1 bg-primary/10 rounded-full overflow-hidden border border-primary/5">
                        <motion.div
                          className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${leak.riskScore * 100}%` }}
                          transition={{ duration: 1 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Invariant Watchpoints */}
            <Card className="console-panel flex-1 flex flex-col overflow-hidden tron-border">
              <CardHeader className="py-3 border-b border-primary/10 flex flex-row items-center gap-2">
                <Target className="w-3 h-3 text-primary" />
                <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em]">
                  Invariant Watchpoints
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 overflow-y-auto custom-scrollbar h-[calc(100vh-600px)]">
                <div className="space-y-3">
                  {watchpoints.map((wp) => (
                    <div
                      key={wp.id}
                      className="flex items-center justify-between p-2 rounded bg-primary/5 border border-primary/10 hover:border-primary/30 transition-all"
                    >
                      <span className="text-[9px] font-bold tracking-widest text-primary/60 truncate w-24 uppercase">
                        {wp.label}
                      </span>
                      <div className="flex items-center gap-3">
                        <Sparkline data={wp.trend} status={wp.status} />
                        <div
                          className={`w-2 h-2 rounded-full ${
                            wp.status === 'stable'
                              ? 'bg-primary shadow-[0_0_8px_#00f2ff]'
                              : wp.status === 'warning'
                                ? 'bg-yellow-500 shadow-[0_0_8px_#ffcc00]'
                                : 'bg-red-500 shadow-[0_0_8px_#ff3333]'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sentinel Verdict Feed */}
            <Card className="console-panel flex-1 flex flex-col overflow-hidden tron-border">
              <CardHeader className="py-3 border-b border-primary/10 flex flex-row items-center gap-2">
                <Terminal className="w-3 h-3 text-primary" />
                <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em]">
                  Sentinel Verdict Feed
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="h-50">
                  <div className="space-y-4">
                    {verdicts.map((v) => (
                      <div key={v.id} className="flex items-start gap-3">
                        <div className="mt-1">
                          {v.status === 'verified' ? (
                            <CheckCircle2 className="w-3 h-3 text-primary animate-pulse" />
                          ) : (
                            <Info className="w-3 h-3 text-primary/60" />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest leading-tight text-primary/80 font-mono">
                            {v.message}{' '}
                            <span className="text-primary/40 ml-1">
                              [BLOCK {v.block}]
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-12 border-t border-primary/20 bg-black/90 backdrop-blur-xl flex items-center justify-between px-6 z-50 tron-border">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
            <span className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">
              Quantum Guard Active
            </span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-primary/20" />
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3 text-primary/40" />
            <span className="text-[10px] font-mono text-primary/40 uppercase tracking-widest">
              L7 Protocol Layer
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3 text-primary/40" />
            <span className="text-[10px] font-mono text-primary/40 uppercase tracking-widest">
              Block Height: 19,420,128
            </span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-primary/20" />
          <div className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">
            {format(currentTime, 'HH:mm:ss')} UTC
          </div>
        </div>
      </footer>

      <div className="reflection" />
    </div>
  );
}
