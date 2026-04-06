"use client";

import { useUIStore } from "./uiStore";

export default function ControlStrip() {
  const mode = useUIStore((s) => s.mode);
  const theme = useUIStore((s) => s.theme);
  const setMode = useUIStore((s) => s.setMode);
  const setTheme = useUIStore((s) => s.setTheme);

  return (
    <div className="flex gap-4 text-sm">
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
