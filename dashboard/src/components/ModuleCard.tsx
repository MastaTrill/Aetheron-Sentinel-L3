import React from 'react';
import {
  Shield,
  TrendingUp,
  Vote,
  Users,
  Activity,
  DollarSign,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface Module {
  name: string;
  address: string;
  isActive: boolean;
  isPaused: boolean;
  lastActivity: number;
}

interface ModuleCardProps {
  module: Module;
  onClick?: () => void;
}

const moduleIcons: Record<string, React.ElementType> = {
  TimeLockVault: Clock,
  YieldAggregator: TrendingUp,
  MultiSigGovernance: Vote,
  GasOptimizer: Activity,
  BridgeHealthMonitor: Shield,
  LiquidityRebalancer: Activity,
  OracleFallbackSystem: Activity,
  CoveragePool: AlertTriangle,
  KeeperNetwork: Users,
  TaskScheduler: Clock,
  RevenueDistributor: DollarSign,
  CrossChainGovernance: Vote,
};

const moduleDescriptions: Record<string, string> = {
  TimeLockVault: 'Treasury vesting & time-locked distributions',
  YieldAggregator: 'Auto-compounding yield across protocols',
  MultiSigGovernance: 'Cross-chain governance with timelocks',
  GasOptimizer: 'Meta-transactions & batched operations',
  BridgeHealthMonitor: 'Real-time bridge monitoring',
  LiquidityRebalancer: 'Auto-rebalance across L2 bridges',
  OracleFallbackSystem: 'Multi-source price feeds',
  CoveragePool: 'Decentralized insurance pool',
  KeeperNetwork: 'Incentivized automation network',
  TaskScheduler: 'Cron-like contract automation',
  RevenueDistributor: 'Protocol revenue splitting',
  CrossChainGovernance: 'Unified L2 governance voting',
};

const ModuleCard: React.FC<ModuleCardProps> = ({ module, onClick }) => {
  const Icon = moduleIcons[module.name] || Shield;
  const description = moduleDescriptions[module.name] || 'Module description';

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-lg p-4 border cursor-pointer transition-all hover:scale-[1.02] ${
        module.isPaused
          ? 'border-gray-600 opacity-60'
          : module.isActive
            ? 'border-blue-500/30 hover:border-blue-500/50'
            : 'border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`p-2 rounded-lg ${module.isActive ? 'bg-blue-500/10' : 'bg-gray-700'}`}
        >
          <Icon
            className={module.isActive ? 'text-blue-500' : 'text-gray-500'}
            size={24}
          />
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${
              module.isPaused
                ? 'bg-yellow-500/20 text-yellow-500'
                : module.isActive
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-gray-600/20 text-gray-400'
            }`}
          >
            {module.isPaused
              ? 'Paused'
              : module.isActive
                ? 'Active'
                : 'Inactive'}
          </span>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-1">{module.name}</h3>
      <p className="text-sm text-gray-400 mb-3">{description}</p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-mono">
          {module.address
            ? `${module.address.slice(0, 6)}...${module.address.slice(-4)}`
            : 'Not deployed'}
        </span>
        <span>Last: {new Date(module.lastActivity).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default ModuleCard;
