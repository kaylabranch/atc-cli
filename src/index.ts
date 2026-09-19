#!/usr/bin/env node

import * as readline from 'node:readline';
import { Simulation } from './simulation/Simulation.js';
import type { Difficulty } from './types.js';

const args = process.argv.slice(2);
const valueFor = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

if (args.includes('--help') || args.includes('-h')) {
  console.log([
    'ATC CLI Simulation',
    '',
    'Options:',
    '  --difficulty <easy|normal|hard>  Set the starting traffic level (default: normal)',
    '  --runways <number>                Configure available runways (default: 2)',
    '  --gates <number>                  Configure available gates (default: 4)',
    '  --flight-count <number>           Configure inbound flights (default: 3)',
    '  --tick-ms <milliseconds>          Set display/update interval (default: 1000)',
    '  --help                            Show this help',
    '',
    'Difficulty presets:',
    '  easy    2 flights, slower update interval',
    '  normal  3 flights, standard update interval',
    '  hard    5 flights, faster update interval',
  ].join('\n'));
  process.exit(0);
}

const difficultyValue = valueFor('--difficulty')?.toLowerCase() ?? 'normal';
const difficulty: Difficulty = difficultyValue === 'easy' || difficultyValue === 'hard' ? difficultyValue : 'normal';
const defaults: Record<Difficulty, { tickMs: number; flightCount: number }> = {
  easy: { tickMs: 1500, flightCount: 2 },
  normal: { tickMs: 1000, flightCount: 3 },
  hard: { tickMs: 750, flightCount: 5 },
};
const preset = defaults[difficulty];
const numberFor = (flag: string, fallback: number): number => {
  const value = Number(valueFor(flag));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const runways = numberFor('--runways', 2);
const gates = numberFor('--gates', 4);
const tickMs = numberFor('--tick-ms', preset.tickMs);
const flightCount = numberFor('--flight-count', preset.flightCount);

const simulation = new Simulation({ runways, gates, tickMs, flightCount, difficulty });
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const output = process.stdout;
const interactiveTerminal = output.isTTY === true;
let lastMessage = '';

const renderScreen = (showPrompt: boolean): void => {
  const screen = [
    'ATC CLI Simulation',
    simulation.renderStatusBoard(),
    simulation.renderAirportLayout(),
    lastMessage ? `\n${lastMessage}` : '',
  ].filter(Boolean).join('\n');

  if (interactiveTerminal) {
    output.write('\u001b[2J\u001b[H');
    output.write(`${screen}\n`);
  } else {
    console.log(screen);
  }

  if (showPrompt) {
    rl.prompt(true);
  }
};

rl.setPrompt('ATC> ');
const interval = setInterval(() => {
  if (simulation.isRunning() && !simulation.isPaused()) {
    simulation.step();
    renderScreen(true);
  }
}, tickMs);

rl.on('line', (input) => {
  const trimmed = input.trim();
  if (!trimmed) {
    renderScreen(true);
    return;
  }

  const result = simulation.handleCommand(trimmed);
  lastMessage = result.message;

  if (trimmed.toLowerCase() === 'exit') {
    clearInterval(interval);
    renderScreen(false);
    rl.close();
    return;
  }

  renderScreen(simulation.isRunning());
});

rl.on('close', () => {
  clearInterval(interval);
});

renderScreen(true);
