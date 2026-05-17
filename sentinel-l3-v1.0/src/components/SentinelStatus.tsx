import { useState, useEffect } from 'react';

// Define the expected shape of the GraphQL response
interface GraphQLSentinel {
  autonomousMode: boolean;
  anomalyCount: number;
  lastAnomalyBlock: number;
}

interface GraphQLData {
  sentinels: GraphQLSentinel[];
}

export default function SentinelStatus() {
  const [data, setData] = useState<GraphQLData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          'https://api.studio.thegraph.com/query/0960a0b2443269219dd37295eb8c5695/aetheron-sentinel-l-3/v0.1.1',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query:
                '{ sentinels(id: "sentinel-global") { autonomousMode anomalyCount lastAnomalyBlock } }',
            }),
          }
        );
        const result = await response.json();
        setData(result.data);
      } catch (e) {
        console.error('Cluster Sync Error:', e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!data)
    return (
      <div className="p-10 text-center animate-pulse text-blue-500">
        Connecting to Sentinel Cluster...
      </div>
    );

  const sentinel = data?.sentinels?.[0];

  return (
    <div className="max-w-xs mx-auto shadow-2xl border-t-4 border-blue-600 bg-white rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-gray-500 text-xs">Aetheron Sentinel</div>
          <div className="text-blue-700 text-2xl font-bold">
            {sentinel?.autonomousMode ? 'ACTIVE' : 'PASSIVE'}
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${sentinel?.autonomousMode ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
        >
          {sentinel?.autonomousMode ? 'Hardened' : 'Manual'}
        </span>
      </div>
      <div className="mt-4 border-t pt-4">
        <div className="text-xs text-gray-400">Security Pulse: Nominal</div>
        <div className="text-[10px] font-mono text-blue-400 mt-1">
          Block: {sentinel?.lastAnomalyBlock}
        </div>
      </div>
    </div>
  );
}
