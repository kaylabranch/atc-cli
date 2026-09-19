#!/usr/bin/env node

import * as readline from 'node:readline';
import { Simulation } from './simulation/Simulation.js';

const args = process.argv.slice(2);
const runways = Number(args[args.indexOf('--runways') + 1]) || 2;
const gates = Number(args[args.indexOf('--gates') + 1]) || 4;
const tickMs = Number(args[args.indexOf('--tick-ms') + 1]) || 1000;
const flightCount = Number(args[args.indexOf('--flight-count') + 1]) || 3;

const simulation = new Simulation({ runways, gates, tickMs, flightCount });
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('ATC CLI Simulation started. Type help for commands.');
console.log(simulation.renderStatusBoard());
console.log(simulation.renderAirportLayout());

const prompt = () => {
  rl.question('ATC> ', (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      prompt();
      return;
    }

    if (trimmed.toLowerCase() === 'exit') {
      const result = simulation.handleCommand(trimmed);
      console.log(result.message);
      rl.close();
      return;
    }

    const result = simulation.handleCommand(trimmed);
    console.log(result.message);

    if (simulation.isRunning()) {
      prompt();
    }
  });
};

setInterval(() => {
  if (simulation.isRunning() && !simulation.isPaused()) {
    simulation.step();
    console.log('\n--- TICK ---');
    console.log(simulation.renderStatusBoard());
    console.log(simulation.renderAirportLayout());
  }
}, tickMs);

prompt();
