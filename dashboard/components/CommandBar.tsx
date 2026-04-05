"use client";

import { useState } from "react";
import { parseCommand } from "./commandParser";
import { getCommandSuggestions } from "./commandRegistry";
import { useSentinelStore } from "./sentinelStore";

export default function CommandBar() {
  const [input, setInput] = useState("");

  const {
    pushOutput,
    clearOutput,
    triggerPulse,
    setState,
    replayBoot,
    activateRitual,
    autocomplete,
    setAutocomplete,
    highlightIndex,
    setHighlightIndex,
  } = useSentinelStore();

  function handleSubmit(e: any) {
    e.preventDefault();
    const result = parseCommand(input);

    switch (result.type) {
      case "output":
        pushOutput(result.message);
        break;
      case "clear":
        clearOutput();
        break;
      case "pulse":
        triggerPulse();
        break;
      case "state":
        setState(result.value);
        break;
      case "reboot":
        replayBoot();
        break;
      case "ritual":
        activateRitual();
        break;
    }

    setInput("");
    setAutocomplete([]);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full bg-zinc-900 border-t border-zinc-800 p-4"
    >
      <div className="relative w-full">
        <input
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            setInput(v);

            const first = v.split(" ")[0];
            const suggestions = getCommandSuggestions(first);
            setAutocomplete(suggestions);
            setHighlightIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlightIndex((i) =>
                Math.min(i + 1, autocomplete.length - 1)
              );
            }

            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightIndex((i) => Math.max(i - 1, 0));
            }

            if (e.key === "Tab") {
              e.preventDefault();
              if (autocomplete.length > 0) {
                setInput(autocomplete[highlightIndex] + " ");
                setAutocomplete([]);
              }
            }
          }}
          className="w-full bg-black text-white p-3 rounded border border-zinc-700"
          placeholder="Enter command…"
        />

        {autocomplete.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded shadow-lg animate-fadeIn">
            {autocomplete.map((cmd, i) => (
              <div
                key={cmd}
                className={`p-2 px-3 cursor-pointer transition-all ${
                  i === highlightIndex
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:bg-zinc-800"
                }`}
                onMouseDown={() => {
                  setInput(cmd + " ");
                  setAutocomplete([]);
                }}
              >
                {cmd}
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}

