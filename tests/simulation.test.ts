import { describe, expect, it } from 'vitest';
import { progressBar } from '../src/cli/color.js';
import { completeCallsign, parseCommand } from '../src/cli/commandParser.js';
import { renderAltitudeChart, renderGridPositions } from '../src/cli/renderer.js';
import { AIRPORT_X, AIRPORT_Y } from '../src/simulation/constants.js';
import { Simulation } from '../src/simulation/Simulation.js';

function prepareForRunway(flight: ReturnType<Simulation['getFlights']>[number], position = 0): void {
  flight.x = AIRPORT_X + 3 + position * 4;
  flight.y = AIRPORT_Y;
  flight.heading = (Math.atan2(AIRPORT_X - flight.x, AIRPORT_Y - flight.y) * 180 / Math.PI + 360) % 360;
  flight.speedTrend = 'decreasing';
  flight.altitudeTrend = 'decreasing';
}

describe('command parsing', () => {
  it('parses a callsign-first command into action and arguments', () => {
    const result = parseCommand('UAL123 speed 240');

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

  it('rejects the old command-first order in favor of callsign-first phraseology', () => {
    expect(parseCommand('speed UAL123 240')).toMatchObject({
      action: 'legacy-order',
      args: ['speed'],
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

    const outcome = sim.handleCommand(`${flight.callsign} speed ${targetSpeed}`);
    expect(outcome.ok).toBe(true);
    expect(sim.getFlight(flight.callsign)?.speed).toBe(initialSpeed);
    expect(sim.getActiveCommands()).toHaveLength(1);
    expect(sim.isCommandInProgress(flight.callsign, 'speed')).toBe(true);

    sim.step();
    expect(sim.getFlight(flight.callsign)?.speed).toBeGreaterThan(initialSpeed);
    expect(sim.getFlight(flight.callsign)?.speed).toBeLessThan(targetSpeed);

    sim.step();
    sim.step();
    sim.step();
    expect(sim.getFlight(flight.callsign)?.speed).toBe(targetSpeed);
    expect(sim.getActiveCommands()).toHaveLength(0);
    expect(sim.isCommandInProgress(flight.callsign, 'speed')).toBe(false);
  });

  it('rejects a duplicate command while the same action is in progress', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    expect(sim.handleCommand(`${flight.callsign} speed 240`).ok).toBe(true);
    const duplicate = sim.handleCommand(`${flight.callsign} speed 260`);

    expect(duplicate.ok).toBe(false);
    expect(duplicate.message).toContain('already has a speed command in progress');
    expect(sim.getActiveCommands()).toHaveLength(1);
  });

  it('uses elapsed time for a large speed increase at 5 kt/s', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const targetSpeed = flight.speed + 100;

    sim.handleCommand(`${flight.callsign} speed ${targetSpeed}`);
    sim.step(10000);

    expect(sim.getActiveCommands()[0].progress).toBeCloseTo(50);
    expect(flight.speed).not.toBe(targetSpeed);

    sim.step(10000);
    expect(flight.speed).toBe(targetSpeed);
  });

  it('completes a speed decrease faster than an equivalent increase', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    flight.speed = 300;
    const targetSpeed = flight.speed - 100;

    sim.handleCommand(`${flight.callsign} speed ${targetSpeed}`);
    sim.step(10000);

    expect(sim.getActiveCommands()[0].progress).toBeCloseTo(50);
    expect(flight.speed).not.toBe(targetSpeed);

    sim.step(10000);
    expect(flight.speed).toBe(targetSpeed);
  });

  it('rejects speed commands outside the min/max commandable range', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    expect(sim.handleCommand(`${flight.callsign} speed 50`).ok).toBe(false);
    expect(sim.handleCommand(`${flight.callsign} speed 900`).ok).toBe(false);
  });

  it('crashes an airborne flight that stalls at zero airspeed outside of a controlled landing', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    flight.state = 'approach';
    flight.speed = 0;

    sim.step();

    expect(flight.state).toBe('crashed');
    expect(flight.statusMessage).toBe('Stalled - lost airspeed and crashed');
  });

  it('accepts a new heading and applies the turn rate to command duration', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const targetHeading = (flight.heading + 90) % 360;

    const outcome = sim.handleCommand(`${flight.callsign} heading ${targetHeading}`);

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

  it('excludes landed, taxiing, and gated flights from spatial charts', () => {
    const sim = new Simulation();
    const flights = sim.getFlights();
    flights[0].state = 'landed';
    flights[1].state = 'taxiing';
    flights[2].state = 'gated';

    const grid = renderGridPositions(flights);
    const altitudeChart = renderAltitudeChart(flights);
    const gridCells = [...grid.matchAll(/\|([^|]*)\|/g)].map((match) => match[1]).join('');
    const altitudeCells = [...altitudeChart.matchAll(/^[ \t]*\d+[ \t]+\|([^\r\n|]*)$/gm)].map((match) => match[1]).join('');

    expect(gridCells).not.toMatch(/[123*]/);
    expect(altitudeCells).not.toMatch(/[123*]/);
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

  it('shows a detailed help menu with usage and constraints for every command', () => {
    const sim = new Simulation();
    const help = sim.handleCommand('help');

    expect(help.ok).toBe(true);
    expect(help.message).toContain('<callsign> speed <knots>');
    expect(help.message).toContain('120-600 kt');
    expect(help.message).toContain('<callsign> runway <77L|77R>');
    expect(help.message).toContain('Workflow');
    expect(help.message).toContain('Examples');
  });

  it('rejects flight commands issued in the old command-first order with guidance', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    const result = sim.handleCommand(`speed ${flight.callsign} 240`);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('callsign-first order');
    expect(result.message).toContain('speed');
  });

  it('closes the help text with close-help', () => {
    const sim = new Simulation();

    const closeResult = sim.handleCommand('close-help');

    expect(closeResult.ok).toBe(true);
    expect(closeResult.message).toBe('');
  });

  it('renders progress beside pending commands', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    prepareForRunway(flight);
    sim.handleCommand(`${flight.callsign} runway 77L`);
    sim.step();

    expect(sim.renderActiveCommands()).toContain('IN PROGRESS');
    expect(sim.renderActiveCommands()).toContain('50%');
  });

  it('requires an inbound heading and decreasing speed and altitude for runway assignment', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    expect(sim.handleCommand(`${flight.callsign} runway 77L`).ok).toBe(false);

    prepareForRunway(flight);

    expect(sim.handleCommand(`${flight.callsign} runway 77L`).ok).toBe(true);
  });

  it('keeps completed decreasing speed and altitude commands eligible for runway assignment', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    prepareForRunway(flight);

    expect(sim.handleCommand(`${flight.callsign} speed ${flight.speed - 10}`).ok).toBe(true);
    expect(sim.handleCommand(`${flight.callsign} altitude ${flight.altitude - 1000}`).ok).toBe(true);
    sim.step(10000);

    expect(flight.speedTrend).toBe('decreasing');
    expect(flight.altitudeTrend).toBe('decreasing');
    expect(sim.handleCommand(`${flight.callsign} runway 77L`).ok).toBe(true);
  });

  it('requires a flight to be within 10 grid units of the airport for landing clearance', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    prepareForRunway(flight);
    sim.handleCommand(`${flight.callsign} runway 77L`);
    sim.step(2000);
    flight.x = AIRPORT_X + 10;
    flight.y = AIRPORT_Y;
    expect(sim.handleCommand(`${flight.callsign} clear-to-land`).ok).toBe(true);
  });

  it.each([
    ['speed', 'speed is increasing'],
    ['altitude', 'altitude is increasing'],
  ])('rejects landing clearance while %s is increasing', (command, expectedMessage) => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    prepareForRunway(flight);
    sim.handleCommand(`${flight.callsign} runway 77L`);
    sim.step(2000);
    const target = command === 'speed' ? flight.speed + 10 : flight.altitude + 1000;
    expect(sim.handleCommand(`${flight.callsign} ${command} ${target}`).ok).toBe(true);

    const result = sim.handleCommand(`${flight.callsign} clear-to-land`);

    expect(result.ok).toBe(false);
    expect(result.message).toContain(expectedMessage);
  });

  it('rejects landing clearance while a heading command turns away from the airport', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    prepareForRunway(flight);
    sim.handleCommand(`${flight.callsign} runway 77L`);
    sim.step(2000);
    expect(sim.handleCommand(`${flight.callsign} heading 90`).ok).toBe(true);

    const result = sim.handleCommand(`${flight.callsign} clear-to-land`);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('turning away from the airport');
  });

  it('scales landing duration to two seconds per grid unit', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    prepareForRunway(flight);
    sim.handleCommand(`${flight.callsign} runway 77L`);
    sim.step(2000);
    flight.x = AIRPORT_X + 3;
    flight.y = AIRPORT_Y;
    expect(sim.handleCommand(`${flight.callsign} clear-to-land`).ok).toBe(true);

    sim.step(5999);
    expect(flight.state).toBe('landing');
    sim.step(1);
    expect(flight.state).toBe('landed');
  });

  it('rejects landing clearance when a flight is more than 10 grid units from the airport', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];

    prepareForRunway(flight);
    sim.handleCommand(`${flight.callsign} runway 77L`);
    sim.step(2000);
    flight.x = AIRPORT_X + 11;
    flight.y = AIRPORT_Y;

    const result = sim.handleCommand(`${flight.callsign} clear-to-land`);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('within 10 grid units');
    expect(flight.state).not.toBe('landing');
    expect(sim.getActiveCommands()).toHaveLength(0);
  });

  it('explains exactly why a runway assignment was rejected', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    flight.x = 0;
    flight.y = 0;
    flight.heading = 225;
    flight.speedTrend = 'steady';
    flight.altitudeTrend = 'steady';

    const rejection = sim.handleCommand(`${flight.callsign} runway 77L`);

    expect(rejection.ok).toBe(false);
    expect(rejection.message).toContain('heading is');
    expect(rejection.message).toContain('speed is');
    expect(rejection.message).toContain('altitude is');
  });

  it('completes an altitude change at the faster 250 ft/s rate', () => {
    const sim = new Simulation();
    const flight = sim.getFlights()[0];
    const targetAltitude = flight.altitude - 2500;

    sim.handleCommand(`${flight.callsign} altitude ${targetAltitude}`);
    sim.step(1000);

    expect(sim.getActiveCommands()[0].progress).toBeCloseTo(10);

    sim.step(9000);
    expect(flight.altitude).toBe(targetAltitude);
  });

  it('prevents runway conflicts and releases a runway when taxiing begins', () => {
    const sim = new Simulation();
    const [firstFlight, secondFlight] = sim.getFlights();

    prepareForRunway(firstFlight, 0);
    prepareForRunway(secondFlight, 1);
    expect(sim.handleCommand(`${firstFlight.callsign} runway 77L`).ok).toBe(true);
    sim.step(2000);
    expect(sim.handleCommand(`${secondFlight.callsign} runway 77L`).ok).toBe(false);

    expect(sim.handleCommand(`${firstFlight.callsign} clear-to-land`).ok).toBe(true);
    sim.step(15000);
    expect(sim.handleCommand(`${firstFlight.callsign} gate A1`).ok).toBe(true);
    sim.step(2000);

    expect(firstFlight.state).toBe('taxiing');
    expect(firstFlight.runway).toBeUndefined();
    prepareForRunway(secondFlight);
    expect(sim.handleCommand(`${secondFlight.callsign} runway 77L`).ok).toBe(true);
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

    expect(flight.x).toBeCloseTo(initialPosition.x + 1.5);
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

    expect(sim.handleCommand(`${flight.callsign} clear-to-land`).ok).toBe(false);
    prepareForRunway(flight);
    flight.x = AIRPORT_X + 5;
    sim.handleCommand(`${flight.callsign} runway 77L`);
    sim.step(2000);
    sim.handleCommand(`${flight.callsign} clear-to-land`);
    expect(flight.state).toBe('landing');
    expect(flight.statusMessage).toBe('Landing in progress');

    sim.step(7500);
    expect(flight.altitude).toBeGreaterThan(0);
    expect(flight.altitude).toBeLessThan(initialAltitude);
    expect(flight.speed).toBeGreaterThan(0);
    expect(flight.speed).toBeLessThan(initialSpeed);

    const abortResult = sim.handleCommand(`${flight.callsign} abort-landing`);
    expect(abortResult.ok).toBe(true);
    expect(flight.state).toBe('climbing');
    expect(flight.speedTrend).toBe('increasing');
    expect(flight.altitudeTrend).toBe('increasing');

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
    sim.handleCommand(`${flight.callsign} runway 77L`);
    sim.step(2000);
    expect(sim.handleCommand(`${flight.callsign} clear-to-land`).ok).toBe(true);
    sim.step(15000);
    expect(sim.getFlight(flight.callsign)?.state).toBe('landed');
    expect(sim.renderStatusBoard()).toContain('Completed: 0');

    expect(sim.handleCommand(`${flight.callsign} gate A1`).ok).toBe(true);
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
    prepareForRunway(flights[0], 0);
    prepareForRunway(flights[1], 1);
    sim.handleCommand(`${flights[0].callsign} runway 77L`);
    sim.handleCommand(`${flights[1].callsign} runway 77R`);
    sim.step(2000);
    sim.handleCommand(`${flights[0].callsign} clear-to-land`);
    sim.handleCommand(`${flights[1].callsign} clear-to-land`);

    sim.step(15000);

    sim.handleCommand(`${flights[0].callsign} gate A1`);
    sim.handleCommand(`${flights[1].callsign} gate A2`);
    sim.step(2000);
    prepareForRunway(flights[2]);
    expect(sim.handleCommand(`${flights[2].callsign} runway 77L`).ok).toBe(true);
    sim.step(2000);
    sim.handleCommand(`${flights[2].callsign} clear-to-land`);
    sim.step(15000);
    sim.handleCommand(`${flights[2].callsign} gate A3`);
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

    prepareForRunway(flights[0], 0);
    prepareForRunway(flights[1], 1);
    sim.handleCommand(`${flights[0].callsign} runway 77L`);
    sim.handleCommand(`${flights[1].callsign} runway 77R`);
    sim.step(2000);
    sim.handleCommand(`${flights[0].callsign} clear-to-land`);
    sim.handleCommand(`${flights[1].callsign} clear-to-land`);

    sim.step(15000);

    sim.handleCommand(`${flights[0].callsign} gate A1`);
    sim.handleCommand(`${flights[1].callsign} gate A2`);
    sim.step(2000);
    prepareForRunway(flights[2]);
    sim.handleCommand(`${flights[2].callsign} runway 77L`);
    sim.step(2000);
    sim.handleCommand(`${flights[2].callsign} clear-to-land`);
    sim.step(15000);
    sim.handleCommand(`${flights[2].callsign} gate A3`);
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
