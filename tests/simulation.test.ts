import { describe, expect, it } from 'vitest';
import { progressBar } from '../src/cli/color.js';
import { completeCallsign, parseCommand } from '../src/cli/commandParser.js';
import { Simulation } from '../src/simulation/Simulation.js';

describe('command parsing', () => {
  it('parses a user command into action and arguments', () => {
    const result = parseCommand('speed UAL123 240');

    expect(result.action).toBe('speed');
    expect(result.args).toEqual(['UAL123', '240']);
  });

  it('parses callsign-first slash commands', () => {
    expect(parseCommand('UAL123 /speed 240')).toMatchObject({
      action: 'speed',
      args: ['UAL123', '240'],
    });
    expect(parseCommand('UAL123 /clear-to-land')).toMatchObject({
      action: 'clear-to-land',
      args: ['UAL123'],
    });
    expect(parseCommand('UAL123 speed 240')).toMatchObject({
      action: 'speed',
      args: ['UAL123', '240'],
    });
  });

  it('completes callsigns only before the first space', () => {
    expect(completeCallsign('NKS', ['NKS580', 'UAL613'])[0]).toEqual(['NKS580']);
    expect(completeCallsign('NKS580 ', ['NKS580'])[0]).toEqual([]);
  });

});

describe('simulation behavior', () => {
  it('updates a flight speed when a valid speed command is issued', () => {
    const sim = new Simulation();
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
    const sim = new Simulation();
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
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const targetHeading = (flight.heading + 90) % 360;

    const outcome = sim.handleCommand(`heading ${flight.callsign} ${targetHeading}`);

    expect(outcome.ok).toBe(true);
    expect(flight.heading).not.toBe(targetHeading);
    sim.step();
    expect(sim.getActiveCommands()[0].progress).toBe(3);
  });

  it('shows the status board for all flights', () => {
    const sim = new Simulation();
    const board = sim.renderStatusBoard();

    expect(board).toContain('ATC STATUS');
    expect(board).toContain('CALLSIGN');
    expect(board).not.toContain('PROGRESS');
  });

  it('shows the altitude cross-section beside the grid', () => {
    const sim = new Simulation();
    const dashboard = sim.renderStatusAndGrid();

    expect(dashboard).toContain('ALTITUDE CROSS-SECTION');
    expect(dashboard).toContain('distance from airport');
  });

  it('renders a visual grid with the airport and flight markers', () => {
    const sim = new Simulation();
    const grid = sim.renderGridPositions();
    const flights = sim.getFlights();

    expect(grid).toContain('GRID POSITIONS');
    expect(grid).toContain('Legend: X=airport, *=multiple flights');
    expect(grid).toContain('X');
    expect(grid).toContain(flights[0].callsign);
    expect(grid).toContain(`+${'-'.repeat(31)}+`);
  });

  it('rounds displayed progress to whole percentages', () => {
    expect(progressBar(12.6)).toContain('13%');
  });

  it('renders progress beside pending commands', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    sim.handleCommand(`runway ${flight.callsign} 77L`);
    sim.step();

    expect(sim.renderActiveCommands()).toContain('IN PROGRESS');
    expect(sim.renderActiveCommands()).toContain('50%');
  });

  it('prevents runway conflicts and releases a runway when taxiing begins', () => {
    const sim = new Simulation();
    const [firstFlight, secondFlight] = sim.getFlights();

    expect(sim.handleCommand(`runway ${firstFlight.callsign} 77L`).ok).toBe(true);
    sim.step(2000);
    expect(sim.handleCommand(`runway ${secondFlight.callsign} 77L`).ok).toBe(false);

    expect(sim.handleCommand(`clear-to-land ${firstFlight.callsign}`).ok).toBe(true);
    sim.step(15000);
    expect(sim.handleCommand(`gate ${firstFlight.callsign} A1`).ok).toBe(true);
    sim.step(2000);

    expect(firstFlight.state).toBe('taxiing');
    expect(firstFlight.runway).toBeUndefined();
    expect(sim.handleCommand(`runway ${secondFlight.callsign} 77L`).ok).toBe(true);
  });

  it('does not move flights without a controller command', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const initialPosition = { x: flight.x, y: flight.y };
    const initialValues = { altitude: flight.altitude, speed: flight.speed, heading: flight.heading };

    sim.step();

    expect({ x: flight.x, y: flight.y }).toEqual(initialPosition);
    expect({ altitude: flight.altitude, speed: flight.speed, heading: flight.heading }).toEqual(initialValues);
  });

  it('descends during landing and can abort into a climb', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const initialAltitude = flight.altitude;
    const initialSpeed = flight.speed;

    expect(sim.handleCommand(`clear-to-land ${flight.callsign}`).ok).toBe(false);
    sim.handleCommand(`runway ${flight.callsign} 77L`);
    sim.step(2000);
    sim.handleCommand(`clear-to-land ${flight.callsign}`);
    expect(flight.state).toBe('landing');
    expect(flight.statusMessage).toBe('Landing in progress');

    sim.step(7500);
    expect(flight.altitude).toBeGreaterThan(0);
    expect(flight.altitude).toBeLessThan(initialAltitude);
    expect(flight.speed).toBeGreaterThan(0);
    expect(flight.speed).toBeLessThan(initialSpeed);

    const abortResult = sim.handleCommand(`abort-landing ${flight.callsign}`);
    expect(abortResult.ok).toBe(true);
    expect(flight.state).toBe('climbing');

    sim.step(7500);
    expect(flight.altitude).toBeGreaterThan(0);
    expect(flight.altitude).toBeGreaterThan(Math.round(initialAltitude / 2));
    sim.step(7500);
    expect(flight.state).toBe('approach');
    expect(flight.altitude).toBe(initialAltitude);
    expect(flight.speed).toBe(initialSpeed);
  });

  it('lands, unloads, and removes a flight after ten seconds at its gate', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    sim.handleCommand(`runway ${flight.callsign} 77L`);
    sim.step(2000);
    expect(sim.handleCommand(`clear-to-land ${flight.callsign}`).ok).toBe(true);
    sim.step(15000);
    expect(sim.getFlight(flight.callsign)?.state).toBe('landed');
    expect(sim.renderStatusBoard()).toContain('Completed: 0');

    expect(sim.handleCommand(`gate ${flight.callsign} A1`).ok).toBe(true);
    sim.step(2000);
    expect(sim.getFlight(flight.callsign)?.state).toBe('taxiing');
    expect(sim.getFlight(flight.callsign)?.statusMessage).toBe('Taxiing to gate A1');
    sim.step(9999);
    expect(sim.getFlight(flight.callsign)?.state).toBe('taxiing');
    sim.step(1);
    expect(sim.getFlight(flight.callsign)?.state).toBe('gated');
    expect(sim.renderActiveCommands()).toContain('Unloading passengers');

    sim.step(9999);
    expect(sim.getFlight(flight.callsign)).toBeDefined();
    sim.step(1);
    expect(sim.getFlight(flight.callsign)).toBeUndefined();
    expect(sim.renderStatusBoard()).toContain('Completed: 1');
  });

  it('starts with three flights and ends when all three complete', () => {
    const sim = new Simulation();
    const flights = sim.getFlights();

    expect(flights).toHaveLength(3);
    sim.handleCommand(`runway ${flights[0].callsign} 77L`);
    sim.handleCommand(`runway ${flights[1].callsign} 77R`);
    sim.step(2000);
    sim.handleCommand(`clear-to-land ${flights[0].callsign}`);
    sim.handleCommand(`clear-to-land ${flights[1].callsign}`);

    sim.step(15000);

    sim.handleCommand(`gate ${flights[0].callsign} A1`);
    sim.handleCommand(`gate ${flights[1].callsign} A2`);
    sim.step(2000);
    expect(sim.handleCommand(`runway ${flights[2].callsign} 77L`).ok).toBe(true);
    sim.step(2000);
    sim.handleCommand(`clear-to-land ${flights[2].callsign}`);
    sim.step(15000);
    sim.handleCommand(`gate ${flights[2].callsign} A3`);
    sim.step(2000);
    sim.step(10000);
    sim.step(10000);

    expect(sim.isGameOver()).toBe(true);
    expect(sim.isRunning()).toBe(false);
    expect(sim.renderStatusBoard()).toContain('GAME OVER');
  });

});
