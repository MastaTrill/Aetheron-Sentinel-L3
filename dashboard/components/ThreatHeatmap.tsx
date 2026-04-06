"use client";

export default function ThreatHeatmap({ threat }) {
  // If threat is undefined, null, or not an array, render a placeholder
  if (!Array.isArray(threat)) {
    return (
      <div className="p-4 text-zinc-400 text-sm border border-zinc-800 rounded">
        ThreatHeatmap: no data
      </div>
    );
  }

  function colorForThreat(v) {
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

