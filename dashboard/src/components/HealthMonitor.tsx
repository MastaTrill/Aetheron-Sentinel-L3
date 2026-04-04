import React, { useState } from 'react';
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface Bridge {
  name: string;
  chain: string;
  healthScore: number;
  volume24h: number;
  transactions24h: number;
  avgLatency: number;
  status: 'Healthy' | 'Warning' | 'Critical';
  lastActivity: string;
}

const mockBridges: Bridge[] = [
  {
    name: 'ETH-ARB Bridge',
    chain: 'Arbitrum',
    healthScore: 96,
    volume24h: 12400000,
    transactions24h: 4521,
    avgLatency: 12,
    status: 'Healthy',
    lastActivity: '2 min ago',
  },
  {
    name: 'ETH-OP Bridge',
    chain: 'Optimism',
    healthScore: 89,
    volume24h: 8900000,
    transactions24h: 3210,
    avgLatency: 18,
    status: 'Healthy',
    lastActivity: '5 min ago',
  },
  {
    name: 'ETH-zkSync',
    chain: 'zkSync',
    healthScore: 72,
    volume24h: 3400000,
    transactions24h: 1203,
    avgLatency: 45,
    status: 'Warning',
    lastActivity: '12 min ago',
  },
  {
    name: 'Polygon Bridge',
    chain: 'Polygon',
    healthScore: 45,
    volume24h: 1200000,
    transactions24h: 456,
    avgLatency: 120,
    status: 'Critical',
    lastActivity: '1 min ago',
  },
];

const HealthMonitor: React.FC = () => {
  const [bridges] = useState<Bridge[]>(mockBridges);

  const avgHealth = Math.round(
    bridges.reduce((sum, b) => sum + b.healthScore, 0) / bridges.length,
  );
  const totalVolume = bridges.reduce((sum, b) => sum + b.volume24h, 0);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-full ${avgHealth > 80 ? 'bg-green-500/10' : avgHealth > 60 ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}
            >
              <Shield
                className={
                  avgHealth > 80
                    ? 'text-green-500'
                    : avgHealth > 60
                      ? 'text-yellow-500'
                      : 'text-red-500'
                }
                size={24}
              />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{avgHealth}%</div>
              <div className="text-sm text-gray-400">Avg Health Score</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-full">
              <TrendingUp className="text-blue-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                ${(totalVolume / 1000000).toFixed(1)}M
              </div>
              <div className="text-sm text-gray-400">24h Volume</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-full">
              <Activity className="text-purple-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {bridges
                  .reduce((sum, b) => sum + b.transactions24h, 0)
                  .toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">24h Transactions</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 rounded-full">
              <AlertTriangle className="text-red-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {bridges.filter((b) => b.status !== 'Healthy').length}
              </div>
              <div className="text-sm text-gray-400">Active Alerts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bridge Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {bridges.map((bridge, i) => (
          <div
            key={i}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {bridge.name}
                </h3>
                <p className="text-sm text-gray-400">{bridge.chain}</p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  bridge.status === 'Healthy'
                    ? 'bg-green-500/20 text-green-400'
                    : bridge.status === 'Warning'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                }`}
              >
                {bridge.status}
              </div>
            </div>

            {/* Health Score Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Health Score</span>
                <span
                  className={`font-medium ${
                    bridge.healthScore > 80
                      ? 'text-green-400'
                      : bridge.healthScore > 60
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }`}
                >
                  {bridge.healthScore}%
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    bridge.healthScore > 80
                      ? 'bg-green-500'
                      : bridge.healthScore > 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${bridge.healthScore}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">24h Volume</div>
                <div className="text-white font-medium">
                  ${(bridge.volume24h / 1000000).toFixed(1)}M
                </div>
              </div>
              <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Transactions</div>
                <div className="text-white font-medium">
                  {bridge.transactions24h.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Avg Latency</div>
                <div
                  className={`font-medium ${
                    bridge.avgLatency < 30
                      ? 'text-green-400'
                      : bridge.avgLatency < 60
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }`}
                >
                  {bridge.avgLatency}s
                </div>
              </div>
              <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Last Activity</div>
                <div className="text-white font-medium">
                  {bridge.lastActivity}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                View Details
              </button>
              <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Alerts */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Alerts</h3>
        <div className="space-y-3">
          <AlertItem
            type="highLatency"
            bridge="Polygon Bridge"
            message="Latency exceeded 2x threshold"
            time="15 min ago"
          />
          <AlertItem
            type="volumeSpike"
            bridge="ETH-ARB"
            message="Unusual volume spike detected (+250%)"
            time="1h ago"
          />
          <AlertItem
            type="resolved"
            bridge="ETH-zkSync"
            message="Low liquidity alert resolved"
            time="3h ago"
          />
        </div>
      </div>
    </div>
  );
};

const AlertItem: React.FC<{
  type: string;
  bridge: string;
  message: string;
  time: string;
}> = ({ type, bridge, message, time }) => (
  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
    <div className="flex items-center gap-3">
      {type === 'resolved' ? (
        <CheckCircle className="text-green-500" size={18} />
      ) : (
        <AlertTriangle
          className={
            type === 'highLatency' ? 'text-red-500' : 'text-yellow-500'
          }
          size={18}
        />
      )}
      <div>
        <div className="text-white font-medium">{message}</div>
        <div className="text-sm text-gray-400">{bridge}</div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${
          type === 'resolved'
            ? 'bg-green-500/20 text-green-400'
            : type === 'highLatency'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-yellow-500/20 text-yellow-400'
        }`}
      >
        {type === 'resolved'
          ? 'Resolved'
          : type === 'highLatency'
            ? 'Critical'
            : 'Warning'}
      </span>
      <span className="text-sm text-gray-500">{time}</span>
    </div>
  </div>
);

export default HealthMonitor;
