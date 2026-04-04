import { useState, useCallback } from 'react';

interface Module {
  name: string;
  address: string;
  isActive: boolean;
  isPaused: boolean;
  lastActivity: number;
}

interface Stats {
  tvl: number;
  tvlChange: number;
  activeModules: number;
  totalModules: number;
  activeProposals: number;
  activeKeepers: number;
  avgHealth: number;
}

interface HubStats {
  moduleHub: string;
  timeLockVault: string;
  yieldAggregator: string;
  multiSigGovernance: string;
  gasOptimizer: string;
  slippageProtection: string;
  bridgeHealthMonitor: string;
  liquidityRebalancer: string;
  oracleFallbackSystem: string;
  automatedTaxModule: string;
  smartWallet: string;
  coveragePool: string;
  predictiveAnalytics: string;
  keeperNetwork: string;
  taskScheduler: string;
  revenueDistributor: string;
  crossChainGovernance: string;
}

const HUB_ADDRESS = '0x0000000000000000000000000000000000000000'; // Update with actual address
const HUB_ABI = [
  'function getHubStats() view returns (uint256 totalModules, uint256 activeModules, uint256 tvl, uint256 totalVolume, uint256 governanceProposals, uint256 activeKeepers)',
  'function getAllModules() view returns (tuple(address moduleAddress, string name, bool isActive, bool isPaused, uint256 lastActivity)[])',
  'function isEmergencyActive() view returns (bool)',
  'function emergencyActive() view returns (bool)',
];

const DEFAULT_MODULES: Module[] = [
  {
    name: 'TimeLockVault',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'YieldAggregator',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'MultiSigGovernance',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'GasOptimizer',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'BridgeHealthMonitor',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'LiquidityRebalancer',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'OracleFallbackSystem',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'CoveragePool',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'KeeperNetwork',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'TaskScheduler',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'RevenueDistributor',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: 'CrossChainGovernance',
    address: '',
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
];

const DEFAULT_STATS: Stats = {
  tvl: 12_450_000,
  tvlChange: 5.2,
  activeModules: 12,
  totalModules: 12,
  activeProposals: 3,
  activeKeepers: 8,
  avgHealth: 94,
};

export const useAetheron = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>(DEFAULT_MODULES);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check for ethereum
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsConnected(true);
        }
      } else {
        // Demo mode - just set connected without wallet
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setWalletAddress(null);
  }, []);

  const refreshStats = useCallback(async () => {
    // In production, fetch from blockchain
    setStats((prev) => ({
      ...prev,
      tvl: prev.tvl + Math.random() * 10000,
    }));
  }, []);

  const getModuleStats = useCallback(async (moduleName: string) => {
    // Return mock stats for each module
    const moduleStats: Record<string, any> = {
      TimeLockVault: { tvl: 2_400_000, schedules: 15, beneficiaries: 45 },
      YieldAggregator: { tvl: 5_200_000, apy: 8.5, sources: 5 },
      MultiSigGovernance: { proposals: 8, active: 3, voters: 124 },
      KeeperNetwork: { active: 8, pendingTasks: 12, totalExecutions: 1_456 },
      BridgeHealthMonitor: { bridges: 4, healthScore: 94, alerts: 2 },
      CoveragePool: { tvl: 890_000, policies: 23, claims: 4 },
    };
    return moduleStats[moduleName] || {};
  }, []);

  return {
    isConnected,
    walletAddress,
    connect,
    disconnect,
    modules,
    stats,
    emergencyActive,
    isLoading,
    refreshStats,
    getModuleStats,
  };
};

// TypeScript declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (params: any) => void) => void;
      removeListener: (event: string, callback: (params: any) => void) => void;
    };
  }
}
