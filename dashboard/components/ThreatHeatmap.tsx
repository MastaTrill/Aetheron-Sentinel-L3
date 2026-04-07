"use client";

interface ThreatHeatmapProps {
  threat: number[][];
}

export default function ThreatHeatmap({ threat }: ThreatHeatmapProps) {
  if (!Array.isArray(threat)) {
    return (
      <div className="text-zinc-500 text-sm">
        No threat data
      </div>
    );
  }

  function colorForThreat(v: number) {
    if (v < 0.33) return "rgba(0, 255, 0, 0.8)";
    if (v < 0.66) return "rgba(255, 165, 0, 0.8)";
    return "rgba(255, 0, 0, 0.8)";
  }

  return (
    <div className="grid grid-cols-6 gap-1">
      {threat.map((row, i) =>
        row.map((cell, j) => (
          <div
            key={`${i}-${j}`}
            className="w-8 h-8"
            style={{ backgroundColor: colorForThreat(cell) }}
          />
        ))
      )}
    </div>
  );
}

