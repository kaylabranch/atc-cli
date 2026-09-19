#!/usr/bin/env node

import * as readline from 'node:readline';
import { Simulation } from './simulation/Simulation.js';

const args = process.argv.slice(2);
if (args[0]?.toLowerCase() === 'clock' && args[1]?.toLowerCase() === 'in') {
  args.splice(0, 2);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log([
    'ATC CLI Simulation',
    '',
    'Options:',
    '  --help                            Show this help',
    '',
    'Airport: runways 77L/77R, gates A1/A2/A3, 3 starting flights',
  ].join('\n'));
  process.exit(0);
}

const simulation = new Simulation();
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
    simulation.renderActiveCommands(),
    simulation.renderAirportLayout(),
    simulation.renderGridPositions(),
    lastMessage ? `\n${lastMessage}` : '',
  ].filter(Boolean).join('\n\n');

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
let lastTickAt = Date.now();
const interval = setInterval(() => {
  const now = Date.now();
  const elapsedMilliseconds = now - lastTickAt;
  lastTickAt = now;

  if (simulation.isRunning() && !simulation.isPaused()) {
    simulation.step(elapsedMilliseconds);
    renderScreen(simulation.isRunning());
  }
}, simulation.getTickMs());

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
