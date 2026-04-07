import { create } from "zustand";

interface SentinelStore {
  output: string[];
  pushOutput: (lines: string[]) => void;
  clearOutput: () => void;
  pulseSignal: number;
  triggerPulse: () => void;
  stateMode: string;
  setState: (mode: string) => void;
  bootReplaySignal: number;
  replayBoot: () => void;
  ritualActive: boolean;
  activateRitual: () => void;
  deactivateRitual: () => void;
  autocomplete: string[];
  setAutocomplete: (list: string[]) => void;
  highlightIndex: number;
  setHighlightIndex: (i: number | ((prev: number) => number)) => void;
}

export const useSentinelStore = create<SentinelStore>((set) => ({
  output: [],

  pushOutput: (lines: string[]) =>
    set((state) => ({ output: [...state.output, ...lines] })),

  clearOutput: () => set({ output: [] }),

  pulseSignal: 0,
  triggerPulse: () => set({ pulseSignal: Date.now() }),

  stateMode: "IDLE",
  setState: (mode: string) => set({ stateMode: mode }),

  bootReplaySignal: 0,
  replayBoot: () => set({ bootReplaySignal: Date.now() }),

  ritualActive: false,
  activateRitual: () => set({ ritualActive: true }),
  deactivateRitual: () => set({ ritualActive: false }),

  autocomplete: [],
  setAutocomplete: (list: string[]) => set({ autocomplete: list }),

  highlightIndex: 0,
  setHighlightIndex: (i: number) => set({ highlightIndex: i }),
}));
