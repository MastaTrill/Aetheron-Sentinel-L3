import { commandRegistry } from "./commandRegistry";

export function parseCommand(input: string) {
  const parts = input.trim().split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (commandRegistry[command]) {
    return commandRegistry[command].execute(args);
  }

  return {
    type: "output",
    message: [`Unknown command: ${command}`, `Type "help" for a list.`],
  };
}

