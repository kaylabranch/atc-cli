import type { CommandResult } from '../types.js';

export interface ParsedCommand {
  action: string;
  args: string[];
  raw: string;
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return { action: 'noop', args: [], raw: '' };
  }

  const parts = trimmed.split(/\s+/);
  const action = parts[0].toLowerCase();

  return {
    action,
    args: parts.slice(1),
    raw: trimmed,
  };
}

export function createCommandResult(ok: boolean, message: string): CommandResult {
  return { ok, message };
}
