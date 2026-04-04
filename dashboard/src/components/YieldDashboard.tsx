import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Shield,
  Activity,
  ChevronRight,
  Plus,
} from 'lucide-react';

interface YieldSource {
  id: string;
  name: string;
  protocol: string;
  tvl: number;
  apy: number;
  riskScore: number;
  lastHarvest: string;
  isActive: boolean;
}

const mockSources: YieldSource[] = [
  {
    id: '1',
    name: 'Aave V3 Strategy',
    protocol: 'Aave',
    tvl: 2_500_000,
    apy: 8.5,
    riskScore: 15,
    lastHarvest: '10 min ago',
    isActive: true,
  },
  {
    id: '2',
    name: 'Compound Strategy',
    protocol: 'Compound',
    tvl: 1_200_000,
    apy: 6.2,
    riskScore: 12,
    lastHarvest: '25 min ago',
    isActive: true,
  },
  {
    id: '3',
    name: 'Convex ETH',
    protocol: 'Convex',
    tvl: 3_800_000,
    apy: 12.4,
    riskScore: 25,
    lastHarvest: '5 min ago',
    isActive: true,
  },
  {
    id: '4',
    name: 'Uniswap V3 LP',
    protocol: 'Uniswap',
    tvl: 890_000,
    apy: 18.7,
    riskScore: 45,
    lastHarvest: '1 min ago',
    isActive: true,
  },
];

const YieldDashboard: React.FC = () => {
  const [sources] = useState<YieldSource[]>(mockSources);
  const [selectedSource, setSelectedSource] = useState<YieldSource | null>(
    null,
  );

  const totalTVL = sources.reduce((sum, s) => sum + s.tvl, 0);
  const avgAPY = (
    sources.reduce((sum, s) => sum + s.apy, 0) / sources.length
  ).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/10 rounded-full">
              <DollarSign className="text-green-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                ${(totalTVL / 1000000).toFixed(1)}M
              </div>
              <div className="text-sm text-gray-400">Total TVL</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-full">
              <TrendingUp className="text-blue-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{avgAPY}%</div>
              <div className="text-sm text-gray-400">Avg APY</div>
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
                {sources.length}
              </div>
              <div className="text-sm text-gray-400">Active Sources</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-500/10 rounded-full">
              <Shield className="text-yellow-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">A+</div>
              <div className="text-sm text-gray-400">Risk Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Yield Sources */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Yield Sources</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
            <Plus size={16} />
            Add Source
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sources.map((source) => (
            <div
              key={source.id}
              onClick={() => setSelectedSource(source)}
              className={`p-4 bg-gray-700/50 rounded-lg border cursor-pointer transition-all hover:bg-gray-700 ${
                selectedSource?.id === source.id
                  ? 'border-blue-500'
                  : 'border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-white font-medium">{source.name}</h4>
                  <p className="text-sm text-gray-400">{source.protocol}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      source.riskScore < 20
                        ? 'bg-green-500/20 text-green-400'
                        : source.riskScore < 40
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    Risk: {source.riskScore}
                  </span>
                  {source.isActive && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                      Active
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-xs text-gray-400 mb-1">TVL</div>
                  <div className="text-lg font-semibold text-white">
                    ${(source.tvl / 1000).toFixed(0)}K
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">APY</div>
                  <div className="text-lg font-semibold text-green-400">
                    {source.apy}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  Last harvest: {source.lastHarvest}
                </span>
                <ChevronRight className="text-gray-400" size={16} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Source Details */}
      {selectedSource && (
        <div className="bg-gray-800 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              {selectedSource.name} Details
            </h3>
            <button
              onClick={() => setSelectedSource(null)}
              className="text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">
                Total Value Locked
              </div>
              <div className="text-2xl font-bold text-white">
                ${selectedSource.tvl.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Current APY</div>
              <div className="text-2xl font-bold text-green-400">
                {selectedSource.apy}%
              </div>
            </div>
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Risk Assessment</div>
              <div className="text-2xl font-bold text-yellow-400">
                {selectedSource.riskScore}/100
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
              Deposit
            </button>
            <button className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              View on Explorer
            </button>
          </div>
        </div>
      )}

      {/* Performance Chart Placeholder */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Yield Performance
        </h3>
        <div className="h-64 bg-gray-700/50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="mx-auto text-gray-500 mb-2" size={48} />
            <p className="text-gray-400">
              Chart visualization would be rendered here
            </p>
            <p className="text-sm text-gray-500">Showing 30-day APY history</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YieldDashboard;
