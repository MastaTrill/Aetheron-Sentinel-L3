"use client";

import RitualOverlay from "../components/RitualOverlay";
import CommandBar from "../components/CommandBar";
import ControlStrip from "../components/ControlStrip";
import IntegrityTimeline from "../components/IntegrityTimeline";
import ThreatHeatmap from "../components/ThreatHeatmap";
import ThreatGrid3D from "../components/ThreatGrid3D";
import StateMachine from "../components/StateMachine";
import StateMachineWheel from "../components/StateMachineWheel";
import AlertStream from "../components/AlertStream";
import GlyphWrapper from "../components/GlyphWrapper";
import { useSentinelFeed } from "../hooks/useSentinelFeed";

export default function Home() {
  const { integrity, threat, state } = useSentinelFeed();

  return (
    <div className="bg-black min-h-screen text-white flex flex-col relative scanlines distortion">
      <RitualOverlay />

      <header className="p-6 border-b border-zinc-800 glitch">
        <h1 className="text-3xl font-bold tracking-widest">
          SENTINEL‑L3 // AETHERON WATCH
        </h1>
      </header>

      <main className="flex-1 p-6 grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-6">
          <div className="glyph-drift glyph-pulse">
            <IntegrityTimeline />
          </div>

          <div className="glyph-drift">
            <ThreatHeatmap threat={threat} />
          </div>
        </div>

        <div className="col-span-5">
          <GlyphWrapper>
            <div className="glitch">
              <ThreatGrid3D />
            </div>
          </GlyphWrapper>
        </div>

        <div className="col-span-3 space-y-6">
          <GlyphWrapper>
            <div className="glitch">
              <StateMachine />
            </div>
          </GlyphWrapper>

          <GlyphWrapper>
            <div className="glitch">
              <StateMachineWheel />
            </div>
          </GlyphWrapper>
        </div>

        <div className="col-span-12">
          <div className="glyph-pulse">
            <AlertStream />
          </div>
        </div>
      </main>

      <CommandBar />
      <ControlStrip />
    </div>
  );
}
