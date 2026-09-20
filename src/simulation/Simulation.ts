import { parseCommand } from '../cli/commandParser.js';
import { renderActiveCommands, renderAirportLayout, renderAltitudeChart, renderFlightDetail, renderGameOverSummary, renderGridPositions, renderSideBySide, renderStatusBoard } from '../cli/renderer.js';
import type { ActiveCommand, CommandResult, Flight } from '../types.js';
import { GATE_COUNT, LANDING_DURATION_MS, RUNWAY_COUNT, STARTING_FLIGHT_COUNT, TICK_MS } from './constants.js';
import { generateFlights } from './flightFactory.js';
import { applyPendingCommand } from './lifecycle.js';
import type { Motion, PendingAction } from './pendingCommands.js';
import { PendingCommands } from './pendingCommands.js';
import { advanceFlightMovement } from './movement.js';
import { canBeAssignedRunway, detectDanger, isRunwayAvailable, redirectFlightsAtBoundary } from './safety.js';

export class Simulation {
  private flights: Flight[] = [];
  private paused = false;
  private running = true;
  private readonly runways: number;
  private readonly gates: number;
  private readonly finishedFlights = new Set<string>();
  private completedFlights = 0;
  private crashedFlights = 0;
  private gameOver = false;
  private readonly pendingCommands = new PendingCommands();

  constructor() {
    this.runways = RUNWAY_COUNT;
    this.gates = GATE_COUNT;
    this.flights = generateFlights();
  }

  getFlight(callsign: string): Flight | undefined {
    return this.flights.find((flight) => flight.callsign.toLowerCase() === callsign.toLowerCase());
  }

  getFlights(): Flight[] {
    return [...this.flights];
  }

  getRunways(): number {
    return this.runways;
  }

  getGates(): number {
    return this.gates;
  }

  getTickMs(): number {
    return TICK_MS;
  }

  getActiveCommands(): ActiveCommand[] {
    return this.pendingCommands.getActive();
  }

  isPaused(): boolean {
    return this.paused;
  }

  isRunning(): boolean {
    return this.running;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  stop(): void {
    this.running = false;
    this.paused = true;
  }

  step(elapsedMilliseconds = TICK_MS): void {
    if (!this.running || this.paused) return;
    const completedCommands = this.pendingCommands.advance(elapsedMilliseconds, (callsign) => this.getFlight(callsign));
    for (const command of completedCommands) {
      applyPendingCommand(command, {
        findFlight: (callsign) => this.getFlight(callsign),
        flights: this.flights,
        pendingCommands: this.pendingCommands,
        isRunwayAvailable: (runway, excludedCallsign) => isRunwayAvailable(this.flights, this.pendingCommands.all, runway, excludedCallsign),
        markCompleted: (callsign) => {
          this.completedFlights += 1;
          this.finishedFlights.add(callsign);
        },
      });
    }

    advanceFlightMovement(this.flights, elapsedMilliseconds);
    redirectFlightsAtBoundary(this.flights);
    const crashedThisTick = detectDanger(this.flights);
    for (const flight of crashedThisTick) {
      this.crashedFlights += 1;
      this.finishedFlights.add(flight.callsign);
    }
    this.checkGameOver();
  }

  handleCommand(input: string): CommandResult {
    const { action, args } = parseCommand(input);

    switch (action) {
      case 'help':
        return { ok: true, message: this.helpText() };
      case 'status':
        return this.handleStatus(args);
      case 'speed':
        return this.handleSpeed(args);
      case 'heading':
        return this.handleHeading(args);
      case 'altitude':
        return this.handleAltitude(args);
      case 'gate':
        return this.handleGate(args);
      case 'runway':
        return this.handleRunway(args);
      case 'clear-to-land':
        return this.handleClearToLand(args);
      case 'abort-landing':
        return this.handleAbortLanding(args);
      case 'hold':
        return this.handleHold(args);
      case 'pause':
        this.paused = true;
        return { ok: true, message: 'Simulation paused.' };
      case 'resume':
        this.paused = false;
        return { ok: true, message: 'Simulation resumed.' };
      case 'exit':
        this.running = false;
        return { ok: true, message: 'Simulation ended. Goodbye.' };
      default:
        return { ok: false, message: `Unknown command: ${action}. Type help for available commands.` };
    }
  }

  renderStatusBoard(): string {
    const activeFlights = this.flights.length;
    const dangerFlights = this.flights.filter((flight) => flight.danger).length;
    const board = renderStatusBoard(this.flights, activeFlights, dangerFlights, this.completedFlights, this.crashedFlights);
    if (!this.gameOver) return board;

    const summary = renderGameOverSummary(this.crashedFlights, STARTING_FLIGHT_COUNT);
    return `${board}\n\n${summary}`;
  }

  renderAirportLayout(): string {
    return renderAirportLayout(this.runways, this.gates);
  }

  renderGridPositions(): string {
    return renderGridPositions(this.flights);
  }

  renderStatusAndGrid(): string {
    const leftColumn = [
      this.renderStatusBoard(),
      this.renderActiveCommands(),
      this.renderAirportLayout(),
    ].join('\n\n');
    const gridAndAltitude = renderSideBySide(this.renderGridPositions(), renderAltitudeChart(this.flights), 3);
    return renderSideBySide(leftColumn, gridAndAltitude);
  }

  renderActiveCommands(): string {
    return renderActiveCommands(this.getActiveCommands());
  }

  private handleStatus(args: string[]): CommandResult {
    if (!args.length || args[0] === 'all') {
      return { ok: true, message: this.renderStatusAndGrid() };
    }

    const flight = this.getFlight(args[0]);
    if (!flight) {
      return { ok: false, message: `No flight found with callsign ${args[0]}.` };
    }

    return { ok: true, message: renderFlightDetail(flight) };
  }

  private handleSpeed(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: speed <callsign> <knots>' };
    const [callsign, rawSpeed] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    const speed = Math.round(Number(rawSpeed));
    if (Number.isNaN(speed)) return { ok: false, message: 'Speed must be a number.' };

    const delta = Math.abs(speed - flight.speed);
    const durationMs = Math.max(1000, Math.ceil((delta / 5) * 1000));
    return this.queueCommand(flight, 'speed', speed, `Speed to ${speed} kt`, durationMs);
  }

  private handleHeading(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: heading <callsign> <degrees>' };
    const [callsign, rawHeading] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    const heading = Math.round(Number(rawHeading));
    if (Number.isNaN(heading)) return { ok: false, message: 'Heading must be a number.' };

    const turnDistance = Math.abs(((heading - flight.heading + 540) % 360) - 180);
    const durationMs = Math.max(1000, Math.ceil((turnDistance / 3) * 1000));
    return this.queueCommand(flight, 'heading', heading, `Heading to ${heading}°`, durationMs);
  }

  private handleAltitude(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: altitude <callsign> <feet>' };
    const [callsign, rawAltitude] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    const altitude = Math.round(Number(rawAltitude));
    if (Number.isNaN(altitude)) return { ok: false, message: 'Altitude must be a number.' };

    const delta = Math.abs(altitude - flight.altitude);
    if (delta > 1500) return { ok: false, message: 'Altitude changes are capped at 1500 ft/min.' };

    const durationMs = Math.max(1000, Math.ceil((delta / 1500) * 60000));
    return this.queueCommand(flight, 'altitude', altitude, `Altitude to ${altitude} ft`, durationMs);
  }

  private handleGate(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: gate <callsign> <gate>' };
    const [callsign, gate] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };
    const normalizedGate = gate.toUpperCase();
    if (!/^A[1-3]$/.test(normalizedGate)) return { ok: false, message: 'Gate must be A1, A2, or A3.' };
    if (flight.state !== 'landed') return { ok: false, message: `${flight.callsign} must be landed before gate assignment.` };

    return this.queueCommand(flight, 'gate', normalizedGate, `Gate assignment ${normalizedGate}`, 2000);
  }

  private handleRunway(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: runway <callsign> <runway>' };
    const [callsign, runway] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };
    const normalizedRunway = runway.toUpperCase();
    if (!/^(77L|77R)$/.test(normalizedRunway)) return { ok: false, message: 'Runway must be 77L or 77R.' };
    if (!canBeAssignedRunway(flight)) {
      return { ok: false, message: `${flight.callsign} must be heading toward the airport while descending and decelerating.` };
    }
    if (!isRunwayAvailable(this.flights, this.pendingCommands.all, normalizedRunway, flight.callsign)) {
      return { ok: false, message: `Runway ${normalizedRunway} is currently occupied.` };
    }

    return this.queueCommand(flight, 'runway', normalizedRunway, `Runway assignment ${normalizedRunway}`, 2000);
  }

  private handleClearToLand(args: string[]): CommandResult {
    if (!args.length) return { ok: false, message: 'Usage: clear-to-land <callsign>' };

    const flight = this.getFlight(args[0]);
    if (!flight) return { ok: false, message: `No flight found with callsign ${args[0]}.` };
    if (!flight.runway) return { ok: false, message: `${flight.callsign} must be assigned a runway before landing clearance.` };

    const result = this.queueCommand(
      flight,
      'clear-to-land',
      '',
      'Landing',
      LANDING_DURATION_MS,
      {
        startAltitude: flight.altitude,
        startSpeed: flight.speed,
        targetAltitude: 0,
        targetSpeed: 0,
      },
    );
    flight.state = 'landing';
    flight.statusMessage = 'Landing in progress';
    flight.danger = false;
    return result;
  }

  private handleAbortLanding(args: string[]): CommandResult {
    if (!args.length) return { ok: false, message: 'Usage: abort-landing <callsign>' };

    const flight = this.getFlight(args[0]);
    if (!flight) return { ok: false, message: `No flight found with callsign ${args[0]}.` };

    const landingCommand = this.pendingCommands.find(
      (command) => command.callsign.toLowerCase() === flight.callsign.toLowerCase() && command.action === 'clear-to-land',
    );
    if (!landingCommand?.motion) return { ok: false, message: `${flight.callsign} is not currently landing.` };

    this.pendingCommands.remove(landingCommand);
    const result = this.queueCommand(
      flight,
      'abort-landing',
      '',
      'Abort landing - climbing',
      LANDING_DURATION_MS,
      {
        startAltitude: flight.altitude,
        startSpeed: flight.speed,
        targetAltitude: landingCommand.motion.startAltitude,
        targetSpeed: landingCommand.motion.startSpeed,
      },
    );
    flight.state = 'climbing';
    flight.statusMessage = 'Landing aborted - climbing';
    return result;
  }

  private handleHold(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: hold <callsign> <left|right>' };
    const [callsign, side] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    return this.queueCommand(flight, 'hold', side, `Hold ${side} pattern`, 2000);
  }

  private queueCommand(
    flight: Flight,
    action: PendingAction,
    target: string | number,
    description: string,
    durationMs: number,
    motion?: Motion,
  ): CommandResult {
    this.pendingCommands.add(flight, action, target, description, durationMs, motion);
    return { ok: true, message: `Command accepted for ${flight.callsign}: ${description}.` };
  }

  private checkGameOver(): void {
    if (this.finishedFlights.size < STARTING_FLIGHT_COUNT) return;

    this.gameOver = true;
    this.running = false;
    this.paused = true;
  }

  private helpText(): string {
    return [
      'Available commands:',
      '  help',
      '  status [all|callsign]',
      '',
      'Flight command registry:',
      '  <callsign> speed <knots>',
      '  <callsign> heading <degrees>',
      '  <callsign> altitude <feet>',
      '  <callsign> gate <A1|A2|A3>',
      '  <callsign> runway <77L|77R>',
      '  <callsign> clear-to-land',
      '  <callsign> abort-landing',
      '  <callsign> hold <left|right>',
      '  speed <callsign> <knots>',
      '  heading <callsign> <degrees>',
      '  altitude <callsign> <feet>',
      '  gate <callsign> <gate>',
      '  runway <callsign> <runway>',
      '  clear-to-land <callsign>',
      '  hold <callsign> <left|right>',
      '  pause',
      '  resume',
      '  exit',
      '',
      'Examples:',
      '  speed UAL123 240',
      '  clear-to-land DLH202',
      '  status all',
    ].join('\n');
  }
}
