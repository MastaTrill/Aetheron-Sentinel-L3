"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SentinelStatus;
const react_1 = require("react");
const react_2 = require("@tremor/react");
function SentinelStatus() {
    const [data, setData] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
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
            }
            catch (e) {
                console.error("Cluster Sync Error:", e);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);
    if (!data)
        return <react_2.Text className="p-10 text-center animate-pulse text-blue-500">Connecting to MAVAN-4 Cluster...</react_2.Text>;
    const sentinel = data?.sentinels?.[0];
    return (<react_2.Card className="max-w-xs mx-auto shadow-2xl border-t-4 border-blue-600 bg-white">
      <react_2.Flex alignItems="start">
        <div>
          <react_2.Text className="font-semibold text-gray-500 text-xs">Aetheron Sentinel</react_2.Text>
          <react_2.Metric className="text-blue-700">{sentinel?.autonomousMode ? "ACTIVE" : "PASSIVE"}</react_2.Metric>
        </div>
        <react_2.Badge color={sentinel?.autonomousMode ? "emerald" : "amber"} size="xl">
          {sentinel?.autonomousMode ? "Hardened" : "Manual"}
        </react_2.Badge>
      </react_2.Flex>
      <div className="mt-4 border-t pt-4">
        <react_2.Text className="text-xs text-gray-400">Security Pulse: Nominal</react_2.Text>
        <react_2.Text className="text-[10px] font-mono text-blue-400 mt-1">Block: {sentinel?.lastAnomalyBlock}</react_2.Text>
      </div>
    </react_2.Card>);
}
