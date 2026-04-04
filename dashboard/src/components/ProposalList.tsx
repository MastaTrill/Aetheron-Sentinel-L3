import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, ChevronRight, Vote } from 'lucide-react';

interface Proposal {
  id: number;
  title: string;
  type: 'Standard' | 'Emergency' | 'ParameterChange' | 'Treasury';
  status: 'Active' | 'Pending' | 'Queued' | 'Executed';
  yesVotes: number;
  noVotes: number;
  endTime: string;
  crossChain: boolean;
}

const mockProposals: Proposal[] = [
  {
    id: 42,
    title: 'Increase slippage tolerance to 1.5%',
    type: 'ParameterChange',
    status: 'Active',
    yesVotes: 1250000,
    noVotes: 320000,
    endTime: '2d 4h',
    crossChain: true,
  },
  {
    id: 41,
    title: 'Allocate $500K to coverage pool',
    type: 'Treasury',
    status: 'Active',
    yesVotes: 2100000,
    noVotes: 180000,
    endTime: '1d 12h',
    crossChain: true,
  },
  {
    id: 40,
    title: 'Emergency: Pause bridge during maintenance',
    type: 'Emergency',
    status: 'Queued',
    yesVotes: 3200000,
    noVotes: 50000,
    endTime: '0d 6h',
    crossChain: false,
  },
];

const ProposalList: React.FC = () => {
  const [proposals] = useState<Proposal[]>(mockProposals);

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Active Proposals</h3>
        <button className="text-sm text-blue-500 hover:text-blue-400 flex items-center gap-1">
          View All <ChevronRight size={14} />
        </button>
      </div>

      <div className="space-y-3">
        {proposals.map((proposal) => (
          <div
            key={proposal.id}
            className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                  #{proposal.id}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    proposal.type === 'Emergency'
                      ? 'bg-red-500/20 text-red-400'
                      : proposal.type === 'Treasury'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-purple-500/20 text-purple-400'
                  }`}
                >
                  {proposal.type}
                </span>
                {proposal.crossChain && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-600 text-gray-300">
                    Cross-Chain
                  </span>
                )}
              </div>
              <div
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                  proposal.status === 'Active'
                    ? 'bg-green-500/20 text-green-400'
                    : proposal.status === 'Queued'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {proposal.status === 'Active' && <Clock size={12} />}
                {proposal.status === 'Queued' && <Vote size={12} />}
                {proposal.status}
              </div>
            </div>

            <h4 className="text-white font-medium mb-3">{proposal.title}</h4>

            <div className="flex items-center gap-4 mb-2">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Votes</span>
                  <span>
                    {(
                      (proposal.yesVotes /
                        (proposal.yesVotes + proposal.noVotes)) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${(proposal.yesVotes / (proposal.yesVotes + proposal.noVotes)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="text-green-400">
                  +{proposal.yesVotes.toLocaleString()}
                </span>
                <span className="text-red-400">
                  -{proposal.noVotes.toLocaleString()}
                </span>
              </div>
              <span>Ends in {proposal.endTime}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProposalList;
