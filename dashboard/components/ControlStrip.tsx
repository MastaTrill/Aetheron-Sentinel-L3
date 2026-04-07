"use client";

import { useUIStore } from "./uiStore";

export default function ControlStrip({ connected }: { connected?: boolean }) {
  const mode = useUIStore((s) => s.mode);
  const theme = useUIStore((s) => s.theme);
  const setMode = useUIStore((s) => s.setMode);
  const setTheme = useUIStore((s) => s.setTheme);

  return (
    <div className="flex gap-4 text-sm items-center">
      <span className={connected ? "text-emerald-400" : "text-red-500"}>
        {connected ? "WS ONLINE" : "WS OFFLINE"}
      </span>

      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as any)}
        className="bg-black border border-zinc-700 p-1"
      >
        <option>Operational</option>
        <option>Forensics</option>
        <option>Dark‑Ops</option>
        <option>Ritual</option>
      </select>

      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        className="bg-black border border-zinc-700 p-1"
      >
        <option>Neon Grid</option>
        <option>Void Black</option>
        <option>Aetheron Blue</option>
        <option>Concord Gold</option>
      </select>
    </div>
  );
}

