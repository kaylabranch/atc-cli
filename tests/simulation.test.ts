import { describe, expect, it } from 'vitest';
import { progressBar } from '../src/cli/color.js';
import { completeCallsign, parseCommand } from '../src/cli/commandParser.js';
import { AIRPORT_X, AIRPORT_Y } from '../src/simulation/constants.js';
import { Simulation } from '../src/simulation/Simulation.js';

function prepareForRunway(flight: ReturnType<Simulation['getFlights']>[number]): void {
  flight.heading = (Math.atan2(AIRPORT_X - flight.x, AIRPORT_Y - flight.y) * 180 / Math.PI + 360) % 360;
  flight.speedTrend = 'decreasing';
  flight.altitudeTrend = 'decreasing';
}

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

  it('uses elapsed time for a large speed increase, which completes slower than an equivalent decrease', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const targetSpeed = flight.speed + 100;

    sim.handleCommand(`speed ${flight.callsign} ${targetSpeed}`);
    sim.step(20000);

    expect(sim.getActiveCommands()[0].progress).toBeCloseTo(50);
    expect(flight.speed).not.toBe(targetSpeed);

    sim.step(20000);
    expect(flight.speed).toBe(targetSpeed);
  });

  it('completes a speed decrease faster than an equivalent increase', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const targetSpeed = flight.speed - 100;

    sim.handleCommand(`speed ${flight.callsign} ${targetSpeed}`);
    sim.step(10000);

    expect(sim.getActiveCommands()[0].progress).toBeCloseTo(50);
    expect(flight.speed).not.toBe(targetSpeed);

    sim.step(10000);
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
    expect(board).toContain('(ALIAS) CALLSIGN');
    expect(board).toContain(`(1) ${sim.getFlights()[0].callsign}`);
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
    expect(grid).toContain('1');
    expect(grid).toContain(`+${'-'.repeat(31)}+`);
  });

  it('rounds displayed progress to whole percentages', () => {
    expect(progressBar(12.6)).toContain('13%');
  });

  it('renders progress beside pending commands', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    prepareForRunway(flight);
    sim.handleCommand(`runway ${flight.callsign} 77L`);
    sim.step();

    expect(sim.renderActiveCommands()).toContain('IN PROGRESS');
    expect(sim.renderActiveCommands()).toContain('50%');
  });

  it('requires an inbound heading and decreasing speed and altitude for runway assignment', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    expect(sim.handleCommand(`runway ${flight.callsign} 77L`).ok).toBe(false);

    prepareForRunway(flight);

    expect(sim.handleCommand(`runway ${flight.callsign} 77L`).ok).toBe(true);
  });

  it('explains exactly why a runway assignment was rejected', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    flight.x = 0;
    flight.y = 0;
    flight.heading = 225;
    flight.speedTrend = 'steady';
    flight.altitudeTrend = 'steady';

    const rejection = sim.handleCommand(`runway ${flight.callsign} 77L`);

    expect(rejection.ok).toBe(false);
    expect(rejection.message).toContain('heading is');
    expect(rejection.message).toContain('speed is');
    expect(rejection.message).toContain('altitude is');
  });

  it('completes an altitude change at the faster 250 ft/s rate', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const targetAltitude = flight.altitude - 2500;

    sim.handleCommand(`altitude ${flight.callsign} ${targetAltitude}`);
    sim.step(1000);

    expect(sim.getActiveCommands()[0].progress).toBeCloseTo(10);

    sim.step(9000);
    expect(flight.altitude).toBe(targetAltitude);
  });

  it('prevents runway conflicts and releases a runway when taxiing begins', () => {
    const sim = new Simulation();
    const [firstFlight, secondFlight] = sim.getFlights();

    prepareForRunway(firstFlight);
    prepareForRunway(secondFlight);
    expect(sim.handleCommand(`runway ${firstFlight.callsign} 77L`).ok).toBe(true);
    sim.step(2000);
    expect(sim.handleCommand(`runway ${secondFlight.callsign} 77L`).ok).toBe(false);

    expect(sim.handleCommand(`clear-to-land ${firstFlight.callsign}`).ok).toBe(true);
    sim.step(15000);
    expect(sim.handleCommand(`gate ${firstFlight.callsign} A1`).ok).toBe(true);
    sim.step(2000);

    expect(firstFlight.state).toBe('taxiing');
    expect(firstFlight.runway).toBeUndefined();
    prepareForRunway(secondFlight);
    expect(sim.handleCommand(`runway ${secondFlight.callsign} 77L`).ok).toBe(true);
  });

  it('moves airborne flights according to heading and speed as time passes', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    flight.x = 15;
    flight.y = 15;
    const initialPosition = { x: flight.x, y: flight.y };

    flight.heading = 90;
    flight.speed = 3600;
    sim.step(1000);

    expect(flight.x).toBeCloseTo(initialPosition.x + 1);
    expect(flight.y).toBeCloseTo(initialPosition.y);
  });

  it('does not move a flight after it has landed', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    flight.state = 'landed';
    const initialPosition = { x: flight.x, y: flight.y };

    sim.step(1000);

    expect({ x: flight.x, y: flight.y }).toEqual(initialPosition);
  });

  it('descends during landing and can abort into a climb', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const initialAltitude = flight.altitude;
    const initialSpeed = flight.speed;

    expect(sim.handleCommand(`clear-to-land ${flight.callsign}`).ok).toBe(false);
    prepareForRunway(flight);
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

    prepareForRunway(flight);
    sim.handleCommand(`runway ${flight.callsign} 77L`);
    sim.step(2000);
    expect(sim.handleCommand(`clear-to-land ${flight.callsign}`).ok).toBe(true);
    sim.step(15000);
    expect(sim.getFlight(flight.callsign)?.state).toBe('landed');
    expect(sim.renderStatusBoard()).toContain('Completed: 0');

    expect(sim.handleCommand(`gate ${flight.callsign} A1`).ok).toBe(true);
    sim.step(2000);
    expect(sim.getFlight(flight.callsign)?.state).toBe('taxiing');
    expect(sim.getFlight(flight.callsign)?.gate).toBe('A1');
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
    prepareForRunway(flights[0]);
    prepareForRunway(flights[1]);
    sim.handleCommand(`runway ${flights[0].callsign} 77L`);
    sim.handleCommand(`runway ${flights[1].callsign} 77R`);
    sim.step(2000);
    sim.handleCommand(`clear-to-land ${flights[0].callsign}`);
    sim.handleCommand(`clear-to-land ${flights[1].callsign}`);

    sim.step(15000);

    sim.handleCommand(`gate ${flights[0].callsign} A1`);
    sim.handleCommand(`gate ${flights[1].callsign} A2`);
    sim.step(2000);
    prepareForRunway(flights[2]);
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

  it('marks flights as crashed on mid-air collision and reports a fired outcome when all flights crash', () => {
    const sim = new Simulation();
    const [firstFlight, secondFlight, thirdFlight] = sim.getFlights();

    firstFlight.x = 10;
    firstFlight.y = 10;
    firstFlight.speed = 0;
    secondFlight.x = 10;
    secondFlight.y = 10;
    secondFlight.speed = 0;
    thirdFlight.x = 10;
    thirdFlight.y = 10;
    thirdFlight.speed = 0;

    sim.step();

    expect(firstFlight.state).toBe('crashed');
    expect(secondFlight.state).toBe('crashed');
    expect(thirdFlight.state).toBe('crashed');
    expect(sim.isGameOver()).toBe(true);
    expect(sim.renderStatusBoard()).toContain('Crashed: 3');
    expect(sim.renderStatusBoard()).toContain('TERMINATED');
  });

  it('reports a promotion outcome when every flight completes without a crash', () => {
    const sim = new Simulation();
    const flights = sim.getFlights();

    prepareForRunway(flights[0]);
    prepareForRunway(flights[1]);
    sim.handleCommand(`runway ${flights[0].callsign} 77L`);
    sim.handleCommand(`runway ${flights[1].callsign} 77R`);
    sim.step(2000);
    sim.handleCommand(`clear-to-land ${flights[0].callsign}`);
    sim.handleCommand(`clear-to-land ${flights[1].callsign}`);

    sim.step(15000);

    sim.handleCommand(`gate ${flights[0].callsign} A1`);
    sim.handleCommand(`gate ${flights[1].callsign} A2`);
    sim.step(2000);
    prepareForRunway(flights[2]);
    sim.handleCommand(`runway ${flights[2].callsign} 77L`);
    sim.step(2000);
    sim.handleCommand(`clear-to-land ${flights[2].callsign}`);
    sim.step(15000);
    sim.handleCommand(`gate ${flights[2].callsign} A3`);
    sim.step(2000);
    sim.step(10000);
    sim.step(10000);

    expect(sim.isGameOver()).toBe(true);
    expect(sim.renderStatusBoard()).toContain('Crashed: 0');
    expect(sim.renderStatusBoard()).toContain('PROMOTED');
  });

  it('redirects an airborne flight back toward the airport when it strays to the airspace boundary', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    flight.x = 0;
    flight.y = 15;
    flight.heading = 270;

    sim.step();

    expect(flight.x).toBe(0);
    expect(flight.danger).toBe(true);
    expect(flight.statusMessage).toBe('Lost near airspace boundary - redirected to airport');
    expect(flight.heading).not.toBe(270);
  });

});
