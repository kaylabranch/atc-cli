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
    const initialSpeed = flight.speed;
    const targetSpeed = initialSpeed + 10;

    const outcome = sim.handleCommand(`speed ${flight.callsign} ${targetSpeed}`);

    expect(outcome.ok).toBe(true);
    expect(sim.getFlight(flight.callsign)?.speed).toBe(initialSpeed);
    expect(sim.getActiveCommands()).toHaveLength(1);

    sim.step();
    expect(sim.getFlight(flight.callsign)?.speed).toBe(initialSpeed);

    sim.step();
    sim.step();
    sim.step();
    expect(sim.getFlight(flight.callsign)?.speed).toBe(targetSpeed);
    expect(sim.getActiveCommands()).toHaveLength(0);
  });

  it('uses elapsed time for a large speed change', () => {
    const sim = new Simulation({ tickMs: 1000, flightCount: 1 });
    const flight = sim.getFlights()[0];
    const targetSpeed = flight.speed + 100;

    sim.handleCommand(`speed ${flight.callsign} ${targetSpeed}`);
    sim.step(1000);

    expect(sim.getActiveCommands()[0].progress).toBeCloseTo(5);
    expect(flight.speed).not.toBe(targetSpeed);

    sim.step(19000);
    expect(flight.speed).toBe(targetSpeed);
  });

  it('accepts a new heading and applies the turn rate to command duration', () => {
    const sim = new Simulation({ tickMs: 1000, flightCount: 1 });
    const flight = sim.getFlights()[0];
    const targetHeading = (flight.heading + 90) % 360;

    const outcome = sim.handleCommand(`heading ${flight.callsign} ${targetHeading}`);

    expect(outcome.ok).toBe(true);
    expect(flight.heading).not.toBe(targetHeading);
    sim.step();
    expect(sim.getActiveCommands()[0].progress).toBeCloseTo(100 / 30);
  });

  it('shows the status board for all flights', () => {
    const sim = new Simulation({ flightCount: 2 });
    const board = sim.renderStatusBoard();

    expect(board).toContain('ATC STATUS');
    expect(board).toContain('CALLSIGN');
    expect(board).not.toContain('PROGRESS');
  });

  it('renders progress beside pending commands', () => {
    const sim = new Simulation({ tickMs: 1000, flightCount: 1 });
    const flight = sim.getFlights()[0];

    sim.handleCommand(`runway ${flight.callsign} 1`);
    sim.step();

    expect(sim.renderActiveCommands()).toContain('IN PROGRESS');
    expect(sim.renderActiveCommands()).toContain('50%');
  });

  it('does not move flights without a controller command', () => {
    const sim = new Simulation({ flightCount: 1, tickMs: 1000 });
    const flight = sim.getFlights()[0];
    const initialFlight = { ...flight };

    sim.step();

    expect(flight).toEqual(initialFlight);
  });

});
