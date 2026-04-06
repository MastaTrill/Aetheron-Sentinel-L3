"use client";

import { create } from "zustand";

type Mode = "Operational" | "Forensics" | "Dark‑Ops" | "Ritual";
type Theme = "Neon Grid" | "Void Black" | "Aetheron Blue" | "Concord Gold";

interface UIState {
  mode: Mode;
  theme: Theme;
  setMode: (m: Mode) => void;
  setTheme: (t: Theme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mode: "Operational",
  theme: "Void Black",
  setMode: (mode) => set({ mode }),
  setTheme: (theme) => {
    document.documentElement.setAttribute(
      "data-theme",
      theme.toLowerCase().replace(" ", "-")
    );
    set({ theme });
  },
}));

