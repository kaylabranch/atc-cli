#!/usr/bin/env node

import * as readline from 'node:readline';
import { completeCallsign } from './cli/commandParser.js';
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
const callsigns = simulation.getFlights().map((flight) => flight.callsign);
const flightCommands = [
  { command: 'speed', usage: 'knots' },
  { command: 'heading', usage: 'degrees' },
  { command: 'altitude', usage: 'feet' },
  { command: 'gate', usage: 'A1|A2|A3' },
  { command: 'runway', usage: '77L|77R' },
  { command: 'clear-to-land', usage: '' },
  { command: 'hold', usage: 'left|right' },
];
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line: string) => completeCallsign(line, callsigns),
});
const output = process.stdout;
const interactiveTerminal = output.isTTY === true;
let lastMessage = '';
let slashMenuIndex: number | null = null;
let suppressNextSlashMenuUpdate = false;

const slashMenuText = (): string => [
  'FLIGHT COMMANDS - use Up/Down to choose',
  ...flightCommands.map((item, index) => `${index === slashMenuIndex ? '>' : ' '} ${item.command}${item.usage ? ` <${item.usage}>` : ''}`),
].join('\n');

const renderSlashMenu = (): void => {
  if (!interactiveTerminal || slashMenuIndex === null) return;

  const menuLines = slashMenuText().split('\n');
  output.write('\u001b7');
  output.write(`\n${menuLines.join('\n')}`);
  output.write('\u001b8');
};

const setInputLine = (line: string): void => {
  const interfaceState = rl as readline.Interface & { line: string; cursor: number };
  interfaceState.line = line;
  interfaceState.cursor = line.length;
};

const updateSlashMenu = (): void => {
  const line = rl.line;
  const previousIndex = slashMenuIndex;
  const menuMatch = line.match(/^(\S+)\s+(?:[a-z-]*)$/i);
  if (!menuMatch || !simulation.getFlight(menuMatch[1])) {
    slashMenuIndex = null;
  } else if (slashMenuIndex === null) {
    slashMenuIndex = 0;
  }

  if (slashMenuIndex !== previousIndex) renderScreen(true);
};

const renderScreen = (showPrompt: boolean): void => {
  const content = [
    'ATC CLI Simulation',
    simulation.renderStatusAndGrid(),
    lastMessage ? `\n${lastMessage}` : '',
  ].filter(Boolean).join('\n\n');
  const screen = `\n\n\n${content}`;

  if (interactiveTerminal) {
    output.write('\u001b[2J\u001b[H');
    output.write(`${screen}\n`);
  } else {
    console.log(screen);
  }

  if (showPrompt) {
    rl.prompt(true);
    renderSlashMenu();
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
  if (slashMenuIndex !== null) {
    const parts = input.trim().split(/\s+/);
    const selectedCommand = parts[1]?.replace(/^\//, '').toLowerCase();
    const command = flightCommands.find((item) => item.command === selectedCommand)?.command
      ?? flightCommands[slashMenuIndex].command;
    setInputLine(`${parts[0]} ${command} `);
    slashMenuIndex = null;
    suppressNextSlashMenuUpdate = true;
    renderScreen(true);
    return;
  }

  slashMenuIndex = null;
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

if (interactiveTerminal) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.on('keypress', (_input, key) => {
    if (suppressNextSlashMenuUpdate) {
      suppressNextSlashMenuUpdate = false;
      return;
    }

    if (slashMenuIndex === null || !key) {
      setImmediate(updateSlashMenu);
      return;
    }

    if (key.name === 'up' || key.name === 'down') {
      const direction = key.name === 'up' ? -1 : 1;
      slashMenuIndex = (slashMenuIndex + direction + flightCommands.length) % flightCommands.length;
      const callsign = rl.line.trim().split(/\s+/)[0];
      setInputLine(`${callsign} ${flightCommands[slashMenuIndex].command} `);
      renderScreen(true);
    } else {
      setImmediate(updateSlashMenu);
    }
  });
}
