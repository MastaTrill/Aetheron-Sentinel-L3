"use client";

import { useSentinelFeed } from "../hooks/useSentinelFeed";

export default function IntegrityTimeline() {
  const { events } = useSentinelFeed();

  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h3 className="text-xl font-semibold mb-4">Integrity Timeline</h3>
      <div className="space-y-2">
        {events.slice(0, 10).map((event, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2 bg-zinc-800 rounded"
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  event.integrity > 0.7
                    ? "bg-green-500"
                    : event.integrity > 0.4
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
              />
              <span className="text-sm">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <span className="font-mono text-sm">
              {Math.round(event.integrity * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
