'use client';

export default function StateMachine({ state }) {
  const states = ['IDLE', 'SCANNING', 'ANALYZING', 'ALERT'];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
      <h3 className="text-lg font-semibold mb-3">State Machine</h3>

      <div className="flex space-x-4">
        {states.map((s) => (
          <div
            key={s}
            className={`px-4 py-2 rounded border ${
              s === state
                ? 'bg-blue-600 border-blue-400'
                : 'bg-zinc-800 border-zinc-700'
            }`}
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
