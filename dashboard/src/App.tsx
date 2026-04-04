import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Shield,
  DollarSign,
  Vote,
  Users,
  Activity,
  Settings,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useAetheron } from './hooks/useAetheron';
import ModuleCard from './components/ModuleCard';
import StatsCard from './components/StatsCard';
import ProposalList from './components/ProposalList';
import KeeperStatus from './components/KeeperStatus';
import HealthMonitor from './components/HealthMonitor';
import YieldDashboard from './components/YieldDashboard';

type TabType =
  | 'overview'
  | 'governance'
  | 'yield'
  | 'keepers'
  | 'health'
  | 'treasury';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { isConnected, connect, stats, modules, emergencyActive, isLoading } =
    useAetheron();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'governance', label: 'Governance', icon: Vote },
    { id: 'yield', label: 'Yield', icon: TrendingUp },
    { id: 'keepers', label: 'Keepers', icon: Users },
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'treasury', label: 'Treasury', icon: DollarSign },
  ];

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Aetheron Sentinel L3
          </h1>
          <p className="text-gray-400 mb-8">
            Unified Dashboard for Cross-Chain Security
          </p>
          <button
            onClick={connect}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Emergency Banner */}
      {emergencyActive && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2">
          <AlertTriangle size={18} />
          <span className="font-medium">EMERGENCY MODE ACTIVE</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="text-blue-500" size={32} />
            <div>
              <h1 className="text-xl font-bold text-white">
                Aetheron Sentinel L3
              </h1>
              <p className="text-sm text-gray-400">Module Hub Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <StatsCard
              label="TVL"
              value={`$${(stats?.tvl || 0).toLocaleString()}`}
              trend={stats?.tvlChange || 0}
            />
            <StatsCard
              label="Modules"
              value={`${stats?.activeModules || 0}/${stats?.totalModules || 0}`}
              trend={0}
            />
            <button className="p-2 hover:bg-gray-700 rounded-lg">
              <Settings className="text-gray-400" size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700 px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-6">
        {activeTab === 'overview' && (
          <OverviewDashboard modules={modules} stats={stats} />
        )}
        {activeTab === 'governance' && <GovernanceDashboard />}
        {activeTab === 'yield' && <YieldDashboard />}
        {activeTab === 'keepers' && <KeeperStatus />}
        {activeTab === 'health' && <HealthMonitor />}
        {activeTab === 'treasury' && <TreasuryDashboard />}
      </main>
    </div>
  );
};

// Overview Dashboard Component
const OverviewDashboard: React.FC<{ modules: any[]; stats: any }> = ({
  modules,
  stats,
}) => {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStatCard
          title="Total Value Locked"
          value={`$${(stats?.tvl || 0).toLocaleString()}`}
          icon={DollarSign}
          color="blue"
        />
        <QuickStatCard
          title="Active Proposals"
          value={stats?.activeProposals || 0}
          icon={Vote}
          color="purple"
        />
        <QuickStatCard
          title="Active Keepers"
          value={stats?.activeKeepers || 0}
          icon={Users}
          color="green"
        />
        <QuickStatCard
          title="Health Score"
          value={`${stats?.avgHealth || 0}%`}
          icon={Activity}
          color={stats?.avgHealth > 80 ? 'green' : 'red'}
        />
      </div>

      {/* Module Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Active Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module) => (
            <ModuleCard key={module.name} module={module} />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity />
        <SystemAlerts />
      </div>
    </div>
  );
};

// Quick Stat Card Component
const QuickStatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ElementType;
  color: 'blue' | 'purple' | 'green' | 'red';
}> = ({ title, value, icon: Icon, color }) => {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{title}</span>
        <Icon size={20} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
};

// Recent Activity Component
const RecentActivity: React.FC = () => {
  const activities = [
    {
      type: 'proposal',
      text: 'Proposal #42 passed',
      time: '5m ago',
      status: 'success',
    },
    {
      type: 'keeper',
      text: 'Task #128 executed',
      time: '12m ago',
      status: 'success',
    },
    {
      type: 'rebalance',
      text: 'Liquidity rebalanced',
      time: '1h ago',
      status: 'success',
    },
    {
      type: 'alert',
      text: 'High volatility detected',
      time: '2h ago',
      status: 'warning',
    },
    {
      type: 'claim',
      text: 'Coverage claim submitted',
      time: '3h ago',
      status: 'pending',
    },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
          >
            <div className="flex items-center gap-3">
              {activity.status === 'success' && (
                <CheckCircle className="text-green-500" size={16} />
              )}
              {activity.status === 'warning' && (
                <AlertTriangle className="text-yellow-500" size={16} />
              )}
              {activity.status === 'pending' && (
                <Clock className="text-blue-500" size={16} />
              )}
              <span className="text-gray-300">{activity.text}</span>
            </div>
            <span className="text-gray-500 text-sm">{activity.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// System Alerts Component
const SystemAlerts: React.FC = () => {
  const [alerts] = useState([
    {
      id: 1,
      message: 'Slippage protection activated on ETH/ARB',
      severity: 'info',
    },
    {
      id: 2,
      message: 'Oracle fallback triggered - using Chainlink',
      severity: 'warning',
    },
    { id: 3, message: 'New keeper registered: 0x7a3...', severity: 'success' },
  ]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">System Alerts</h3>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-lg ${
              alert.severity === 'warning'
                ? 'bg-yellow-500/10 border border-yellow-500/20'
                : alert.severity === 'info'
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'bg-green-500/10 border border-green-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {alert.severity === 'warning' && (
                <AlertTriangle className="text-yellow-500" size={16} />
              )}
              {alert.severity === 'info' && (
                <Activity className="text-blue-500" size={16} />
              )}
              {alert.severity === 'success' && (
                <CheckCircle className="text-green-500" size={16} />
              )}
              <span className="text-gray-300">{alert.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Governance Dashboard Component
const GovernanceDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <ProposalList />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VotingPower />
        <CreateProposal />
      </div>
    </div>
  );
};

// Voting Power Component
const VotingPower: React.FC = () => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">
        Your Voting Power
      </h3>
      <div className="text-3xl font-bold text-blue-500 mb-4">12,450 AETH</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Native Chain</span>
          <span>8,000</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Arbitrum</span>
          <span>2,500</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Optimism</span>
          <span>1,950</span>
        </div>
      </div>
    </div>
  );
};

// Create Proposal Component
const CreateProposal: React.FC = () => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Create Proposal</h3>
      <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2">
        New Cross-Chain Proposal
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

// Treasury Dashboard Component
const TreasuryDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickStatCard
          title="Treasury Balance"
          value="$2.4M"
          icon={DollarSign}
          color="blue"
        />
        <QuickStatCard
          title="Time Locked"
          value="$890K"
          icon={Clock}
          color="purple"
        />
        <QuickStatCard
          title="Pending Claims"
          value="$45K"
          icon={AlertTriangle}
          color="yellow"
        />
      </div>
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Allocation</h3>
        <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            style={{ width: '100%' }}
          />
        </div>
        <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
          <div>
            <span className="text-gray-400">Treasury:</span>{' '}
            <span className="text-white">40%</span>
          </div>
          <div>
            <span className="text-gray-400">Staking:</span>{' '}
            <span className="text-white">30%</span>
          </div>
          <div>
            <span className="text-gray-400">Insurance:</span>{' '}
            <span className="text-white">20%</span>
          </div>
          <div>
            <span className="text-gray-400">Development:</span>{' '}
            <span className="text-white">10%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
