export const commandRegistry = {
  help: {
    description: "List all available commands",
    execute: () => ({
      type: "output",
      message: [
        "Available Commands:",
        "• help — show this list",
        "• clear — clear the console",
        "• pulse — trigger heatmap pulse",
        "• state <mode> — change state machine mode",
        "• reboot — replay boot sequence",
        "• ritual — activate ritual overlay",
      ],
    }),
  },

  clear: {
    description: "Clear the command output",
    execute: () => ({ type: "clear" }),
  },

  pulse: {
    description: "Trigger a heatmap pulse",
    execute: () => ({ type: "pulse" }),
  },

  reboot: {
    description: "Replay the boot sequence",
    execute: () => ({ type: "reboot" }),
  },

  ritual: {
    description: "Activate ritual overlay",
    execute: () => ({ type: "ritual" }),
  },

  state: {
    description: "Change state machine mode",
    execute: (args: string[]) => ({
      type: "state",
      value: args[0],
    }),
  },
};

export function getCommandSuggestions(prefix: string) {
  if (!prefix) return [];
  const keys = Object.keys(commandRegistry);
  return keys.filter((k) => k.startsWith(prefix.toLowerCase()));
}

