#!/usr/bin/env node

import * as readline from 'node:readline';
import { completeCallsign, parseCommand } from './cli/commandParser.js';
import { Simulation } from './simulation/Simulation.js';

const args = process.argv.slice(2);
if (args[0]?.toLowerCase() === 'clock' && args[1]?.toLowerCase() === 'in') {
  args.splice(0, 2);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log([
    'ATC CLI Simulation',
    '',
    'Usage:',
    '  npm run clock-in         Start the simulation',
    '  npm run dev -- --help    Show this help',
    '',
    'Options:',
    '  --help, -h                        Show this help',
    '',
    'Airport: runways 77L/77R, gates A1/A2/A3, 3 starting flights',
    'Once running, type "help" at the ATC> prompt for the full command list.',
  ].join('\n'));
  process.exit(0);
}

const simulation = new Simulation();
const flightCommands = [
  { command: 'speed', usage: 'knots' },
  { command: 'heading', usage: 'degrees' },
  { command: 'altitude', usage: 'feet' },
  { command: 'gate', usage: 'A1|A2|A3' },
  { command: 'runway', usage: '77L|77R' },
  { command: 'clear-to-land', usage: '' },
  { command: 'abort-landing', usage: '' },
  { command: 'hold', usage: 'left|right' },
];
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line: string) => completeCallsign(line, simulation.getFlights().map((flight) => flight.callsign)),
});
const output = process.stdout;
const interactiveTerminal = output.isTTY === true;
let lastMessage = '';
let lastPendingCommand: { callsign: string; action: string } | null = null;
let slashMenuIndex: number | null = null;
let slashMenuQuery = '';
let suppressNextSlashMenuUpdate = false;
let inputHintVisible = false;
const inputHint = 'callsign command value';

const getSlashMenuOptions = (): typeof flightCommands => flightCommands.filter((item) => item.command.startsWith(slashMenuQuery));

const slashMenuText = (): string => [
  'FLIGHT COMMANDS - use Up/Down to choose',
  ...getSlashMenuOptions().map((item, index) => `${index === slashMenuIndex ? '>' : ' '} ${item.command}${item.usage ? ` <${item.usage}>` : ''}`),
].join('\n');

const renderSlashMenu = (): void => {
  if (!interactiveTerminal || slashMenuIndex === null) return;

  const menuLines = slashMenuText().split('\n');
  output.write('\u001b7');
  output.write(`\n${menuLines.join('\n')}`);
  output.write('\u001b8');
};

const renderInputHint = (): void => {
  if (!interactiveTerminal || rl.line.length > 0) {
    inputHintVisible = false;
    return;
  }

  output.write(`\u001b[3;90m${inputHint}\u001b[0m`);
  readline.moveCursor(output, -inputHint.length, 0);
  inputHintVisible = true;
};

const setInputLine = (line: string): void => {
  const interfaceState = rl as readline.Interface & { line: string; cursor: number };
  interfaceState.line = line;
  interfaceState.cursor = line.length;
};

const acceptSlashMenuSelection = (suppressKeypressRefresh: boolean): void => {
  const parts = rl.line.trim().split(/\s+/);
  const selectedCommand = parts[1]?.replace(/^\//, '').toLowerCase();
  const command = getSlashMenuOptions().find((item) => item.command === selectedCommand)?.command
    ?? getSlashMenuOptions()[slashMenuIndex ?? 0].command;
  setInputLine(`${parts[0]} ${command} `);
  slashMenuIndex = null;
  slashMenuQuery = '';
  suppressNextSlashMenuUpdate = suppressKeypressRefresh;
  renderScreen(true);
};

const updateSlashMenu = (): void => {
  const line = rl.line;
  const previousIndex = slashMenuIndex;
  const menuMatch = line.match(/^(\S+)\s+([a-z-]*)$/i);
  if (!menuMatch || !simulation.getFlight(menuMatch[1])) {
    slashMenuIndex = null;
    slashMenuQuery = '';
  } else {
    const query = menuMatch[2].toLowerCase();
    const queryChanged = query !== slashMenuQuery;
    slashMenuQuery = query;
    const optionCount = getSlashMenuOptions().length;
    slashMenuIndex = optionCount === 0 ? null : queryChanged || slashMenuIndex === null
      ? 0
      : Math.min(slashMenuIndex, optionCount - 1);
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
    renderInputHint();
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
    if (lastPendingCommand && !simulation.isCommandInProgress(lastPendingCommand.callsign, lastPendingCommand.action)) {
      lastMessage = '';
      lastPendingCommand = null;
    }
    renderScreen(simulation.isRunning());
  }
}, simulation.getTickMs());

rl.on('line', (input) => {
  if (slashMenuIndex !== null) {
    acceptSlashMenuSelection(true);
    return;
  }

  slashMenuIndex = null;
  slashMenuQuery = '';
  const trimmed = input.trim();
  if (!trimmed) {
    renderScreen(true);
    return;
  }

  const parsedCommand = parseCommand(trimmed);
  const result = simulation.handleCommand(trimmed);
  lastMessage = result.message;
  lastPendingCommand = result.ok && parsedCommand.args[0] && simulation.isCommandInProgress(parsedCommand.args[0], parsedCommand.action)
    ? { callsign: parsedCommand.args[0], action: parsedCommand.action }
    : null;

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
      setImmediate(() => {
        if (rl.line.length > 0 && inputHintVisible) {
          inputHintVisible = false;
          renderScreen(true);
        } else if (rl.line.length === 0 && !inputHintVisible && slashMenuIndex === null) {
          renderScreen(true);
        } else {
          updateSlashMenu();
        }
      });
      return;
    }

    if (key.name === 'up' || key.name === 'down') {
      const optionCount = getSlashMenuOptions().length;
      const direction = key.name === 'up' ? -1 : 1;
      slashMenuIndex = (slashMenuIndex + direction + optionCount) % optionCount;
      const callsign = rl.line.trim().split(/\s+/)[0];
      setInputLine(`${callsign} ${flightCommands[slashMenuIndex].command} `);
      renderScreen(true);
    } else if (key.name === 'tab') {
      acceptSlashMenuSelection(false);
    } else {
      setImmediate(updateSlashMenu);
    }
  });
}
