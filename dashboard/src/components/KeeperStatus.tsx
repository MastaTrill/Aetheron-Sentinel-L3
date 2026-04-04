import React, { useState } from 'react';
import {
  Users,
  Activity,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface Keeper {
  address: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  reputation: number;
  bonded: number;
  executions: number;
  successRate: number;
  isActive: boolean;
}

const mockKeepers: Keeper[] = [
  {
    address: '0x7a3B...f9E2',
    tier: 'Platinum',
    reputation: 98,
    bonded: 15000,
    executions: 456,
    successRate: 99.2,
    isActive: true,
  },
  {
    address: '0x4d2C...a8B7',
    tier: 'Gold',
    reputation: 92,
    bonded: 3500,
    executions: 234,
    successRate: 97.5,
    isActive: true,
  },
  {
    address: '0x9f1A...c3D5',
    tier: 'Gold',
    reputation: 88,
    bonded: 2800,
    executions: 189,
    successRate: 95.8,
    isActive: true,
  },
  {
    address: '0x2b8E...d7F1',
    tier: 'Silver',
    reputation: 78,
    bonded: 800,
    executions: 67,
    successRate: 92.5,
    isActive: true,
  },
];

const KeeperStatus: React.FC = () => {
  const [keepers] = useState<Keeper[]>(mockKeepers);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const totalBonded = keepers.reduce((sum, k) => sum + k.bonded, 0);
  const avgReputation = Math.round(
    keepers.reduce((sum, k) => sum + k.reputation, 0) / keepers.length,
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Users className="text-green-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {keepers.length}
              </div>
              <div className="text-sm text-gray-400">Active Keepers</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <DollarSign className="text-blue-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {totalBonded.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">Total Bonded</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Activity className="text-purple-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {avgReputation}%
              </div>
              <div className="text-sm text-gray-400">Avg Reputation</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="text-yellow-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">12</div>
              <div className="text-sm text-gray-400">Pending Tasks</div>
            </div>
          </div>
        </div>
      </div>

      {/* Keeper List */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Keeper Network</h3>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Register as Keeper
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                <th className="pb-3">Keeper</th>
                <th className="pb-3">Tier</th>
                <th className="pb-3">Bonded</th>
                <th className="pb-3">Reputation</th>
                <th className="pb-3">Executions</th>
                <th className="pb-3">Success Rate</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {keepers.map((keeper, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30"
                >
                  <td className="py-3 font-mono text-gray-300">
                    {keeper.address}
                  </td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        keeper.tier === 'Platinum'
                          ? 'bg-purple-500/20 text-purple-400'
                          : keeper.tier === 'Gold'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : keeper.tier === 'Silver'
                              ? 'bg-gray-500/20 text-gray-300'
                              : 'bg-orange-500/20 text-orange-400'
                      }`}
                    >
                      {keeper.tier}
                    </span>
                  </td>
                  <td className="py-3 text-white">
                    {keeper.bonded.toLocaleString()}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            keeper.reputation >= 90
                              ? 'bg-green-500'
                              : keeper.reputation >= 70
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${keeper.reputation}%` }}
                        />
                      </div>
                      <span className="text-gray-300">
                        {keeper.reputation}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-white">{keeper.executions}</td>
                  <td className="py-3 text-green-400">{keeper.successRate}%</td>
                  <td className="py-3">
                    {keeper.isActive ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle size={14} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <AlertTriangle size={14} /> Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Tasks */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Pending Tasks</h3>
        <div className="space-y-3">
          <TaskItem
            type="Compound"
            pool="Aave V3"
            reward="0.01 ETH"
            priority="High"
          />
          <TaskItem
            type="Rebalance"
            bridges="ETH-ARB"
            amount="$50K"
            priority="Medium"
          />
          <TaskItem
            type="Harvest"
            protocol="Convex"
            reward="0.005 ETH"
            priority="Low"
          />
        </div>
      </div>
    </div>
  );
};

const TaskItem: React.FC<{
  type: string;
  pool?: string;
  bridges?: string;
  protocol?: string;
  reward?: string;
  amount?: string;
  priority: string;
}> = ({ type, pool, bridges, protocol, reward, amount, priority }) => (
  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-500/10 rounded">
        <Activity size={16} className="text-blue-500" />
      </div>
      <div>
        <div className="text-white font-medium">{type} Task</div>
        <div className="text-sm text-gray-400">
          {pool && `Pool: ${pool}`}
          {bridges && `Bridges: ${bridges}`}
          {protocol && `Protocol: ${protocol}`}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-400">
        {reward && `Reward: ${reward}`}
        {amount && `Amount: ${amount}`}
      </span>
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${
          priority === 'High'
            ? 'bg-red-500/20 text-red-400'
            : priority === 'Medium'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-gray-500/20 text-gray-400'
        }`}
      >
        {priority}
      </span>
    </div>
  </div>
);

export default KeeperStatus;
