import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/cli/commandParser.js';
import { Simulation } from '../src/simulation/Simulation.js';

describe('command parsing', () => {
  it('parses a user command into action and arguments', () => {
    const result = parseCommand('speed UAL123 240');

    expect(result.action).toBe('speed');
    expect(result.args).toEqual(['UAL123', '240']);
  });
});

describe('simulation behavior', () => {
  it('updates a flight speed when a valid speed command is issued', () => {
    const sim = new Simulation({ runways: 2, gates: 4, tickMs: 500, flightCount: 1 });
    const flight = sim.getFlights()[0];

    const outcome = sim.handleCommand(`speed ${flight.callsign} 240`);

    expect(outcome.ok).toBe(true);
    expect(sim.getFlight(flight.callsign)?.speed).toBe(240);
  });

  it('shows the status board for all flights', () => {
    const sim = new Simulation({ flightCount: 2 });
    const board = sim.renderStatusBoard();

    expect(board).toContain('ATC STATUS');
    expect(board).toContain('CALLSIGN');
  });

  it('scales movement by elapsed time instead of update frequency', () => {
    const sim = new Simulation({ flightCount: 1, tickMs: 1000 });
    const flight = sim.getFlights()[0];
    const initialProgress = flight.progress;
    const initialHeading = flight.heading;

    sim.step(0.5);

    expect(flight.progress).toBeCloseTo(initialProgress + 1);
    expect(flight.heading).toBeCloseTo((initialHeading + 1.5) % 360);
  });

  it('stores the selected difficulty', () => {
    const sim = new Simulation({ difficulty: 'hard' });

    expect(sim.getDifficulty()).toBe('hard');
  });
});
