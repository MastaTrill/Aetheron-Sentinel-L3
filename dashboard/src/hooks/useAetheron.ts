import { useState, useCallback } from "react";
import { ethers } from "ethers";

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

const HUB_ADDRESS =
  import.meta.env.VITE_HUB_ADDRESS ||
  "0x0000000000000000000000000000000000000000";
const HUB_ABI = [
  "function getHubStats() view returns (uint256 totalModules, uint256 activeModules, uint256 tvl, uint256 totalVolume, uint256 governanceProposals, uint256 activeKeepers)",
  "function getAllModules() view returns (tuple(address moduleAddress, string name, bool isActive, bool isPaused, uint256 lastActivity)[])",
  "function isEmergencyActive() view returns (bool)",
];

const DEFAULT_MODULES: Module[] = [
  {
    name: "TimeLockVault",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "YieldAggregator",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "MultiSigGovernance",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "GasOptimizer",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "BridgeHealthMonitor",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "LiquidityRebalancer",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "OracleFallbackSystem",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "CoveragePool",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "KeeperNetwork",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "TaskScheduler",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "RevenueDistributor",
    address: "",
    isActive: true,
    isPaused: false,
    lastActivity: Date.now(),
  },
  {
    name: "CrossChainGovernance",
    address: "",
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

  // Provider and contract refs (not state to avoid re-renders)
  let provider: ethers.Provider | null = null;
  let hubContract: ethers.Contract | null = null;

  const initContract = useCallback(async () => {
    if (
      !HUB_ADDRESS ||
      HUB_ADDRESS === "0x0000000000000000000000000000000000000000"
    ) {
      console.warn("Hub address not configured");
      return;
    }
    if (typeof window !== "undefined" && window.ethereum) {
      provider = new ethers.BrowserProvider(window.ethereum);
    } else {
      provider = ethers.getDefaultProvider("sepolia");
    }
    hubContract = new ethers.Contract(HUB_ADDRESS, HUB_ABI, provider);
  }, []);

  const refreshStats = useCallback(async () => {
    if (!hubContract) return;
    try {
      const statsData = await hubContract.getHubStats();
      const [
        totalModules,
        activeModules,
        tvl,
        totalVolume,
        governanceProposals,
        activeKeepers,
      ] = statsData as bigint[];
      setStats({
        tvl: Number(tvl),
        tvlChange: 0,
        activeModules: Number(activeModules),
        totalModules: Number(totalModules),
        activeProposals: Number(governanceProposals),
        activeKeepers: Number(activeKeepers),
        avgHealth: 0,
      });
    } catch (error) {
      console.error("Failed to fetch hub stats:", error);
    }
  }, []);

  const loadModules = useCallback(async () => {
    if (!hubContract) return;
    try {
      const modulesData = await hubContract.getAllModules();
      const formattedModules: Module[] = modulesData.map(
        (mod: [string, string, boolean, boolean, bigint]) => ({
          name: mod[1],
          address: mod[0],
          isActive: mod[2],
          isPaused: mod[3],
          lastActivity: Number(mod[4]),
        }),
      );
      setModules(formattedModules);
    } catch (error) {
      console.error("Failed to fetch modules:", error);
    }
  }, []);

  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      let account: string | undefined;
      if (typeof window !== "undefined" && window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        account = accounts[0];
        setWalletAddress(account || null);
      } else {
        setWalletAddress(null);
      }
      setIsConnected(true);
      await initContract();
      await refreshStats();
      await loadModules();
    } catch (error) {
      console.error("Failed to connect:", error);
    } finally {
      setIsLoading(false);
    }
  }, [initContract, refreshStats, loadModules]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setWalletAddress(null);
    provider = null;
    hubContract = null;
  }, []);

  const getModuleStats = useCallback(async (moduleName: string) => {
    return {};
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
    loadModules,
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
