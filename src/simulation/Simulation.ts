import { parseCommand } from '../cli/commandParser.js';
import { renderActiveCommands, renderAirportLayout, renderAltitudeChart, renderFlightDetail, renderGameOverSummary, renderGridPositions, renderHelp, renderSideBySide, renderStatusBoard } from '../cli/renderer.js';
import type { ActiveCommand, CommandResult, Flight } from '../types.js';
import { AIRPORT_X, AIRPORT_Y, ALTITUDE_RATE_FT_PER_SEC, GATE_COUNT, LANDING_DURATION_MS_PER_GRID_UNIT, MAX_LANDING_CLEARANCE_DISTANCE_UNITS, MAX_SPEED_KTS, MIN_SPEED_KTS, RUNWAY_COUNT, SPEED_DECREASE_RATE_KT_PER_SEC, SPEED_INCREASE_RATE_KT_PER_SEC, STARTING_FLIGHT_COUNT, TICK_MS } from './constants.js';
import { generateFlights } from './flightFactory.js';
import { applyPendingCommand } from './lifecycle.js';
import type { Motion, PendingAction } from './pendingCommands.js';
import { PendingCommands } from './pendingCommands.js';
import { advanceFlightMovement } from './movement.js';
import { detectDanger, detectStalledFlights, getRunwayAssignmentIssues, isHeadingTowardAirport, isRunwayAvailable, redirectFlightsAtBoundary } from './safety.js';

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

  isCommandInProgress(callsign: string, action: string): boolean {
    return this.pendingCommands.all.some((command) =>
      command.callsign.toLowerCase() === callsign.toLowerCase() && command.action === action
    );
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
    const stalledThisTick = detectStalledFlights(this.flights);
    for (const flight of stalledThisTick) {
      this.crashedFlights += 1;
      this.finishedFlights.add(flight.callsign);
    }
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
        return { ok: true, message: renderHelp() };
      case 'close-help':
        return { ok: true, message: '' };
      case 'legacy-order': {
        const [attemptedCommand] = args;
        return { ok: false, message: `Flight commands use callsign-first order: <callsign> ${attemptedCommand} <value>.` };
      }
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
    if (args.length < 2) return { ok: false, message: 'Usage: <callsign> speed <knots>' };
    const [callsign, rawSpeed] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    const speed = Math.round(Number(rawSpeed));
    if (Number.isNaN(speed)) return { ok: false, message: 'Speed must be a number.' };
    if (speed < MIN_SPEED_KTS || speed > MAX_SPEED_KTS) {
      return { ok: false, message: `Speed must be between ${MIN_SPEED_KTS} and ${MAX_SPEED_KTS} kt.` };
    }

    const delta = Math.abs(speed - flight.speed);
    const rate = speed < flight.speed ? SPEED_DECREASE_RATE_KT_PER_SEC : SPEED_INCREASE_RATE_KT_PER_SEC;
    const durationMs = Math.max(1000, Math.ceil((delta / rate) * 1000));
    return this.queueCommand(flight, 'speed', speed, `Speed to ${speed} kt`, durationMs);
  }

  private handleHeading(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: <callsign> heading <degrees>' };
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
    if (args.length < 2) return { ok: false, message: 'Usage: <callsign> altitude <feet>' };
    const [callsign, rawAltitude] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    const altitude = Math.round(Number(rawAltitude));
    if (Number.isNaN(altitude)) return { ok: false, message: 'Altitude must be a number.' };

    const delta = Math.abs(altitude - flight.altitude);
    const durationMs = Math.max(1000, Math.ceil((delta / ALTITUDE_RATE_FT_PER_SEC) * 1000));
    return this.queueCommand(flight, 'altitude', altitude, `Altitude to ${altitude} ft`, durationMs);
  }

  private handleGate(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: <callsign> gate <gate>' };
    const [callsign, gate] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };
    const normalizedGate = gate.toUpperCase();
    if (!/^A[1-3]$/.test(normalizedGate)) return { ok: false, message: 'Gate must be A1, A2, or A3.' };
    if (flight.state !== 'landed') return { ok: false, message: `${flight.callsign} must be landed before gate assignment.` };
    if (!this.isGateAvailable(normalizedGate, flight.callsign)) {
      return { ok: false, message: `Gate ${normalizedGate} is currently occupied.` };
    }

    return this.queueCommand(flight, 'gate', normalizedGate, `Gate assignment ${normalizedGate}`, 2000);
  }

  private handleRunway(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: <callsign> runway <runway>' };
    const [callsign, runway] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };
    const normalizedRunway = runway.toUpperCase();
    if (!/^(77L|77R)$/.test(normalizedRunway)) return { ok: false, message: 'Runway must be 77L or 77R.' };
    const issues = getRunwayAssignmentIssues(flight);
    if (issues.length) {
      return { ok: false, message: `${flight.callsign} cannot be assigned a runway: ${issues.join('; ')}.` };
    }
    if (!isRunwayAvailable(this.flights, this.pendingCommands.all, normalizedRunway, flight.callsign)) {
      return { ok: false, message: `Runway ${normalizedRunway} is currently occupied.` };
    }

    return this.queueCommand(flight, 'runway', normalizedRunway, `Runway assignment ${normalizedRunway}`, 2000);
  }

  private handleClearToLand(args: string[]): CommandResult {
    if (!args.length) return { ok: false, message: 'Usage: <callsign> clear-to-land' };

    const flight = this.getFlight(args[0]);
    if (!flight) return { ok: false, message: `No flight found with callsign ${args[0]}.` };
    if (!flight.runway) return { ok: false, message: `${flight.callsign} must be assigned a runway before landing clearance.` };
    const distanceFromAirport = Math.sqrt((flight.x - AIRPORT_X) ** 2 + (flight.y - AIRPORT_Y) ** 2);
    if (distanceFromAirport > MAX_LANDING_CLEARANCE_DISTANCE_UNITS) {
      return { ok: false, message: `${flight.callsign} is ${Math.round(distanceFromAirport)} grid units from the airport; landing clearance requires being within ${MAX_LANDING_CLEARANCE_DISTANCE_UNITS} grid units.` };
    }
    const speedCommand = this.pendingCommands.find(
      (command) => command.callsign.toLowerCase() === flight.callsign.toLowerCase() && command.action === 'speed',
    );
    if (flight.speedTrend !== 'decreasing' || (speedCommand && (speedCommand.target as number) > flight.speed)) {
      const speedTrend = speedCommand && (speedCommand.target as number) > flight.speed ? 'increasing' : flight.speedTrend;
      return { ok: false, message: `${flight.callsign} cannot be cleared to land while speed is ${speedTrend}; speed must be decreasing.` };
    }
    const altitudeCommand = this.pendingCommands.find(
      (command) => command.callsign.toLowerCase() === flight.callsign.toLowerCase() && command.action === 'altitude',
    );
    if (flight.altitudeTrend !== 'decreasing' || (altitudeCommand && (altitudeCommand.target as number) > flight.altitude)) {
      const altitudeTrend = altitudeCommand && (altitudeCommand.target as number) > flight.altitude ? 'increasing' : flight.altitudeTrend;
      return { ok: false, message: `${flight.callsign} cannot be cleared to land while altitude is ${altitudeTrend}; altitude must be decreasing.` };
    }
    const headingCommand = this.pendingCommands.find(
      (command) => command.callsign.toLowerCase() === flight.callsign.toLowerCase() && command.action === 'heading',
    );
    if (headingCommand && !isHeadingTowardAirport(flight, headingCommand.target as number)) {
      return { ok: false, message: `${flight.callsign} cannot be cleared to land while turning away from the airport.` };
    }
    const landingDurationMs = Math.max(1000, Math.ceil(distanceFromAirport * LANDING_DURATION_MS_PER_GRID_UNIT));

    const result = this.queueCommand(
      flight,
      'clear-to-land',
      '',
      'Landing',
      landingDurationMs,
      {
        startAltitude: flight.altitude,
        startSpeed: flight.speed,
        targetAltitude: 0,
        targetSpeed: 0,
      },
    );
    if (!result.ok) return result;

    flight.state = 'landing';
    flight.statusMessage = 'Landing in progress';
    flight.danger = false;
    return result;
  }

  private handleAbortLanding(args: string[]): CommandResult {
    if (!args.length) return { ok: false, message: 'Usage: <callsign> abort-landing' };

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
      landingCommand.durationMs,
      {
        startAltitude: flight.altitude,
        startSpeed: flight.speed,
        targetAltitude: landingCommand.motion.startAltitude,
        targetSpeed: landingCommand.motion.startSpeed,
      },
    );
    flight.state = 'climbing';
    flight.speedTrend = 'increasing';
    flight.altitudeTrend = 'increasing';
    flight.statusMessage = 'Landing aborted - climbing';
    return result;
  }

  private queueCommand(
    flight: Flight,
    action: PendingAction,
    target: string | number,
    description: string,
    durationMs: number,
    motion?: Motion,
  ): CommandResult {
    if (this.pendingCommands.isInProgress(flight.callsign, action)) {
      return { ok: false, message: `${flight.callsign} already has a ${action} command in progress.` };
    }

    this.pendingCommands.add(flight, action, target, description, durationMs, motion);
    return { ok: true, message: `Command accepted for ${flight.callsign}: ${description}.` };
  }

  private isGateAvailable(gate: string, excludedCallsign: string): boolean {
    const assignedToOtherFlight = this.flights.some(
      (flight) => flight.callsign.toLowerCase() !== excludedCallsign.toLowerCase()
        && flight.gate?.toUpperCase() === gate
        && flight.state !== 'crashed',
    );
    const pendingForOtherFlight = this.pendingCommands.all.some(
      (command) => command.action === 'gate'
        && command.callsign.toLowerCase() !== excludedCallsign.toLowerCase()
        && String(command.target).toUpperCase() === gate,
    );

    return !assignedToOtherFlight && !pendingForOtherFlight;
  }

  private checkGameOver(): void {
    if (this.finishedFlights.size < STARTING_FLIGHT_COUNT) return;

    this.gameOver = true;
    this.running = false;
    this.paused = true;
  }
}
