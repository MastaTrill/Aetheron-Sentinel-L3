"use client";

export default function StateMachine({ states }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
      <h3 className="text-lg font-semibold mb-3">State Machine</h3>
      <svg width="800" height="300">
        <circle
          cx="150"
          cy="150"
          r="60"
          stroke="#6A4BFF"
          strokeWidth="10"
          fill="#1A1A22"
        />
        <circle
          cx="400"
          cy="150"
          r="60"
          stroke="#6A4BFF"
          strokeWidth="10"
          fill="#1A1A22"
        />
        <circle
          cx="650"
          cy="150"
          r="60"
          stroke="#6A4BFF"
          strokeWidth="10"
          fill="#1A1A22"
        />

        <line
          x1="210"
          y1="150"
          x2="340"
          y2="150"
          stroke="#3AF2FF"
          strokeWidth="6"
        />
        <line
          x1="460"
          y1="150"
          x2="590"
          y2="150"
          stroke="#3AF2FF"
          strokeWidth="6"
        />

        {states.slice(-1).map((s, i) => (
          <text key={i} x="400" y="260" fill="#3AF2FF" fontSize="20">
            {s.st}
          </text>
        ))}
      </svg>
    </div>
  );
}
