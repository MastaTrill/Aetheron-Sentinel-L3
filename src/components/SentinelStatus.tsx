import { useState, useEffect } from 'react';
import { Card, Badge, Text, Metric, Flex } from '@tremor/react';

export default function SentinelStatus() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('https://api.studio.thegraph.com/query/0960a0b2443269219dd37295eb8c5695/aetheron-sentinel-l-3/v0.1.1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: '{ sentinels(id: "sentinel-global") { autonomousMode anomalyCount lastAnomalyBlock } }'
          }),
        });
        const result = await response.json();
        setData(result.data);
      } catch (e) { console.error("Cluster Sync Error:", e); }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <Text className="p-10 text-center animate-pulse text-blue-500">Connecting to MAVAN-4 Cluster...</Text>;

  const sentinel = data?.sentinels?.[0];

  return (
    <Card className="max-w-xs mx-auto shadow-2xl border-t-4 border-blue-600 bg-white">
      <Flex alignItems="start">
        <div>
          <Text className="font-semibold text-gray-500 text-xs">Aetheron Sentinel</Text>
          <Metric className="text-blue-700">{sentinel?.autonomousMode ? "ACTIVE" : "PASSIVE"}</Metric>
        </div>
        <Badge color={sentinel?.autonomousMode ? "emerald" : "amber"} size="xl">
          {sentinel?.autonomousMode ? "Hardened" : "Manual"}
        </Badge>
      </Flex>
      <div className="mt-4 border-t pt-4">
        <Text className="text-xs text-gray-400">Security Pulse: Nominal</Text>
        <Text className="text-[10px] font-mono text-blue-400 mt-1">Block: {sentinel?.lastAnomalyBlock}</Text>
      </div>
    </Card>
  );
}
