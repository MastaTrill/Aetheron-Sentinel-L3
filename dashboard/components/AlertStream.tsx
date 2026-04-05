"use client";

import { useSentinelFeed } from "../hooks/useSentinelFeed";

export default function AlertStream() {
  const { events } = useSentinelFeed();

  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h3 className="text-xl font-semibold mb-4">Alert Stream</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {events
          .filter((e) => e.threat > 0.7)
          .slice(0, 8)
          .map((event, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 bg-red-900/30 border border-red-800 rounded"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <div className="flex-1">
                <div className="text-sm font-medium">High threat detected</div>
                <div className="text-xs text-zinc-400">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <span className="text-red-400 font-mono text-sm">
                {Math.round(event.threat * 100)}%
              </span>
            </div>
          ))}
        {events.filter((e) => e.threat > 0.7).length === 0 && (
          <div className="text-zinc-500 text-center py-8">
            No active threats
          </div>
        )}
      </div>
    </div>
  );
}
