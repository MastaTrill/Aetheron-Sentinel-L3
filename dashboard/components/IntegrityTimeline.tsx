'use client';

import { useSentinelFeed } from '../hooks/useSentinelFeed';

export default function IntegrityTimeline() {
  const { events = [] } = useSentinelFeed();

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-zinc-400">
      <h3 className="text-sm font-semibold mb-2">Integrity Timeline</h3>
      <div className="text-xs text-zinc-500">
        Timeline stream pending — events: {events.length}
      </div>
    </div>
  );
}
