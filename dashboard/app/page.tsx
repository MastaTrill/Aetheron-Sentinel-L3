// dashboard/app/page.tsx
'use client';

import React from 'react';
import { useSentinelFeed } from '../hooks/useSentinelFeed';
import CommandBar from '../components/CommandBar';
import ThreatGraph from '../components/ThreatGraph';
import Heatmap from '../components/Heatmap';
import StateMachine from '../components/StateMachine';
import AlertFeed from '../components/AlertFeed';

export default function Home() {
  const {
    events = [],
    connected = false,
    threat = [],
    integrity = 100,
    state = 'IDLE',
  } = useSentinelFeed();

  return (
    <div className="h-full flex flex-col gap-6">
      <section className="console-panel px-5 py-4">
        <div className="console-panel-header">
          <span className="text-zinc-500">L3 // Sentinel Command Surface</span>
          <div className="flex items-center gap-3">
            <span className="console-chip">
              <span
                className={`console-chip-dot ${
                  connected
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.9)]'
                    : 'bg-red-500'
                }`}
              />
              {connected ? 'WS LINKED' : 'WS OFFLINE'}
            </span>

            <span className="console-chip">
              Integrity{' '}
              <span
                className={
                  integrity > 80
                    ? 'text-emerald-400'
                    : integrity > 50
                      ? 'text-amber-300'
                      : 'text-red-400'
                }
              >
                {Number(integrity).toFixed(0)}%
              </span>
            </span>

            <span className="console-chip">
              State <span className="text-cyan-300">{state}</span>
            </span>
          </div>
        </div>

        <CommandBar />
      </section>

      <section className="console-grid flex-1">
        <div className="space-y-4">
          <div className="console-panel p-4">
            <div className="console-panel-header">
              <span>Integrity Vector</span>
              <span className="text-[10px] text-zinc-500">L3-THR / 01</span>
            </div>
            <ThreatGraph data={(threat as any[]).flat?.() ?? []} />
          </div>

          <div className="console-panel p-4">
            <div className="console-panel-header">
              <span>Surface Heatmap</span>
              <span className="text-[10px] text-zinc-500">L3-THR / 02</span>
            </div>
            <Heatmap grid={threat} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="console-panel p-4">
            <div className="console-panel-header">
              <span>State Machine</span>
              <span className="text-[10px] text-zinc-500">L3-CTRL / 01</span>
            </div>
            <StateMachine state={state} />
          </div>

          <div className="console-panel p-4">
            <div className="console-panel-header">
              <span>Integrity Timeline</span>
              <span className="text-[10px] text-zinc-500">L3-INT / 01</span>
            </div>
            <div className="text-xs text-zinc-500">
              Timeline stream pending — events: {events.length}
            </div>
          </div>
        </div>

        <div className="console-panel p-4 flex flex-col">
          <div className="console-panel-header">
            <span>Alert Feed</span>
            <span className="text-[10px] text-zinc-500">L3-ALRT / 01</span>
          </div>
          <div className="flex-1 min-h-0">
            <AlertFeed alerts={events} autoScroll={true} maxItems={200} />
          </div>
        </div>
      </section>
    </div>
  );
}
