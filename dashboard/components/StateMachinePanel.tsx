"use client";

import { useSentinelFeed } from "../hooks/useSentinelFeed";

export default function StateMachinePanel() {
  const { events } = useSentinelFeed();
  const currentState = events[0]?.state ?? "IDLE";

  const states = ["IDLE", "SCAN", "LOCK", "VERIFY"] as const;

  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h3 className="text-xl font-semibold mb-4">State Machine</h3>
      <div className="space-y-3">
        {states.map((state) => (
          <div
            key={state}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              currentState === state
                ? "border-green-500 bg-green-900/20"
                : "border-zinc-700 bg-zinc-800/50"
            }`}
          >
            <span className="font-medium">{state}</span>
            {currentState === state && (
              <span className="text-green-400 text-sm animate-pulse">
                ACTIVE
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
