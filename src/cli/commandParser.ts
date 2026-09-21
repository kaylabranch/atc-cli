import type { CommandResult } from '../types.js';

const FLIGHT_COMMANDS = new Set(['speed', 'heading', 'altitude', 'gate', 'runway', 'clear-to-land', 'abort-landing']);

export interface ParsedCommand {
  action: string;
  args: string[];
  raw: string;
}

/** Flight commands must use real-world ATC phrasing: callsign, then command, then value. */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return { action: 'noop', args: [], raw: '' };
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length >= 2) {
    const command = parts[1].startsWith('/') ? parts[1].slice(1).toLowerCase() : parts[1].toLowerCase();
    if (FLIGHT_COMMANDS.has(command)) {
      return {
        action: command,
        args: [parts[0], ...parts.slice(2)],
        raw: trimmed,
      };
    }
  }

  const action = parts[0].toLowerCase();
  if (FLIGHT_COMMANDS.has(action)) {
    return { action: 'legacy-order', args: [action], raw: trimmed };
  }

  return {
    action,
    args: parts.slice(1),
    raw: trimmed,
  };
}

export function createCommandResult(ok: boolean, message: string): CommandResult {
  return { ok, message };
}

export function completeCallsign(line: string, callsigns: string[]): [string[], string] {
  if (/\s/.test(line)) return [[], line];

  const prefix = line.toLowerCase();
  return [
    callsigns.filter((callsign) => callsign.toLowerCase().startsWith(prefix)),
    line,
  ];
}
