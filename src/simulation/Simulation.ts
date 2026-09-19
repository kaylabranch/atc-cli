import { parseCommand } from '../cli/commandParser.js';
import { renderActiveCommands, renderAirportLayout, renderAltitudeChart, renderFlightDetail, renderGridPositions, renderSideBySide, renderStatusBoard } from '../cli/renderer.js';
import type { ActiveCommand, CommandResult, Flight } from '../types.js';

const AIRPORT_NAMES = ['KJFK', 'KSFO', 'KDEN', 'KSEA', 'PHX'];
const AIRLINE_PREFIXES = ['UAL', 'DLH', 'BAW', 'SWA', 'AAL', 'NKS'];
const RUNWAY_COUNT = 2;
const GATE_COUNT = 3;
const STARTING_FLIGHT_COUNT = 3;
const UNLOAD_DURATION_MS = 10000;
const TAXI_TO_GATE_DURATION_MS = 10000;
const LANDING_DURATION_MS = 15000;
const TICK_MS = 1000;
type PendingAction = 'speed' | 'heading' | 'altitude' | 'gate' | 'runway' | 'clear-to-land' | 'abort-landing' | 'hold' | 'taxi-to-gate' | 'unload';
type Motion = {
  startAltitude: number;
  startSpeed: number;
  targetAltitude: number;
  targetSpeed: number;
};
type PendingCommand = ActiveCommand & {
  action: PendingAction;
  target: string | number;
  durationMs: number;
  elapsedMs: number;
  motion?: Motion;
};

export class Simulation {
  private flights: Flight[] = [];
  private paused = false;
  private running = true;
  private readonly runways: number;
  private readonly gates: number;
  private readonly finishedFlights = new Set<string>();
  private completedFlights = 0;
  private gameOver = false;
  private pendingCommands: PendingCommand[] = [];
  private nextCommandId = 1;

  constructor() {
    this.runways = RUNWAY_COUNT;
    this.gates = GATE_COUNT;
    this.generateFlights();
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
    return this.pendingCommands.map(({ id, callsign, description, progress }) => ({
      id,
      callsign,
      description,
      progress: Math.round(progress),
    }));
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
    for (const command of this.pendingCommands) {
      command.elapsedMs += elapsedMilliseconds;
      command.progress = Math.min(100, (command.elapsedMs / command.durationMs) * 100);
      if (command.motion) {
        const flight = this.getFlight(command.callsign);
        if (flight) {
          const ratio = command.progress / 100;
          flight.altitude = Math.round(command.motion.startAltitude + (command.motion.targetAltitude - command.motion.startAltitude) * ratio);
          flight.speed = Math.round(command.motion.startSpeed + (command.motion.targetSpeed - command.motion.startSpeed) * ratio);
        }
      }
    }

    const completedCommands = this.pendingCommands.filter((command) => command.progress >= 100);
    this.pendingCommands = this.pendingCommands.filter((command) => command.progress < 100);
    for (const command of completedCommands) {
      this.applyPendingCommand(command);
    }

    this.detectDanger();
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
    const board = renderStatusBoard(this.flights, activeFlights, dangerFlights, this.completedFlights);
    return this.gameOver ? `${board}\n\nGAME OVER - All starting flights are landed or crashed.` : board;
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

    return this.queueCommand(flight, 'altitude', altitude, `Altitude to ${altitude} ft`, 3000);
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
    if (!this.isRunwayAvailable(normalizedRunway, flight.callsign)) {
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

    this.pendingCommands = this.pendingCommands.filter((command) => command !== landingCommand);
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
    const command: PendingCommand = {
      id: this.nextCommandId,
      callsign: flight.callsign,
      description,
      progress: 0,
      action,
      target,
      durationMs,
      elapsedMs: 0,
      motion,
    };
    this.nextCommandId += 1;
    this.pendingCommands.push(command);
    return { ok: true, message: `Command accepted for ${flight.callsign}: ${description}.` };
  }

  private applyPendingCommand(command: PendingCommand): void {
    const flight = this.getFlight(command.callsign);
    if (!flight) return;

    switch (command.action) {
      case 'speed':
        flight.speed = command.target as number;
        flight.statusMessage = `Speed adjusted to ${flight.speed} kt`;
        break;
      case 'heading':
        flight.heading = command.target as number;
        flight.statusMessage = `Heading adjusted to ${flight.heading}°`;
        break;
      case 'altitude':
        flight.altitude = command.target as number;
        flight.statusMessage = `Altitude adjusted to ${flight.altitude} ft`;
        break;
      case 'gate':
        flight.gate = command.target as string;
        flight.runway = undefined;
        flight.state = 'taxiing';
        flight.statusMessage = `Taxiing to gate ${flight.gate}`;
        this.pendingCommands.push({
          id: this.nextCommandId,
          callsign: flight.callsign,
          description: `Taxiing to gate ${flight.gate}`,
          progress: 0,
          action: 'taxi-to-gate',
          target: flight.gate,
          durationMs: TAXI_TO_GATE_DURATION_MS,
          elapsedMs: 0,
        });
        this.nextCommandId += 1;
        break;
      case 'taxi-to-gate':
        flight.state = 'gated';
        flight.statusMessage = `Assigned to gate ${flight.gate}`;
        this.pendingCommands.push({
          id: this.nextCommandId,
          callsign: flight.callsign,
          description: 'Unloading passengers',
          progress: 0,
          action: 'unload',
          target: flight.gate ?? '',
          durationMs: UNLOAD_DURATION_MS,
          elapsedMs: 0,
        });
        this.nextCommandId += 1;
        break;
      case 'runway':
        if (this.isRunwayAvailable(command.target as string, flight.callsign)) {
          flight.runway = command.target as string;
          flight.statusMessage = `Assigned to runway ${flight.runway}`;
        } else {
          flight.statusMessage = `Runway ${command.target as string} is occupied`;
        }
        break;
      case 'clear-to-land':
        flight.altitude = 0;
        flight.speed = 0;
        flight.state = 'landed';
        flight.statusMessage = 'Landed - awaiting gate assignment';
        flight.danger = false;
        break;
      case 'abort-landing':
        flight.state = 'approach';
        flight.statusMessage = 'Landing aborted - returning to approach';
        break;
      case 'hold':
        flight.state = 'holding';
        flight.statusMessage = `Holding ${command.target as string} pattern`;
        break;
      case 'unload':
        this.completedFlights += 1;
        this.finishedFlights.add(flight.callsign);
        this.flights = this.flights.filter((candidate) => candidate.callsign !== flight.callsign);
        break;
    }

  }

  private detectDanger(): void {
    for (let i = 0; i < this.flights.length; i += 1) {
      for (let j = i + 1; j < this.flights.length; j += 1) {
        const a = this.flights[i];
        const b = this.flights[j];

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 3) {
          a.danger = true;
          b.danger = true;
          a.statusMessage = 'Conflict alert';
          b.statusMessage = 'Conflict alert';
        }
      }
    }
  }

  private checkGameOver(): void {
    if (this.finishedFlights.size < STARTING_FLIGHT_COUNT) return;

    this.gameOver = true;
    this.running = false;
    this.paused = true;
  }

  private isRunwayAvailable(runway: string, excludedCallsign: string): boolean {
    const assignedToOtherFlight = this.flights.some(
      (flight) => flight.callsign !== excludedCallsign
        && flight.runway === runway
        && flight.state !== 'taxiing'
        && flight.state !== 'gated',
    );
    const pendingForOtherFlight = this.pendingCommands.some(
      (command) => command.action === 'runway'
        && command.callsign !== excludedCallsign
        && command.target === runway,
    );

    return !assignedToOtherFlight && !pendingForOtherFlight;
  }

  private generateFlights(): void {
    for (let i = 0; i < STARTING_FLIGHT_COUNT; i += 1) {
      const prefix = AIRLINE_PREFIXES[Math.floor(Math.random() * AIRLINE_PREFIXES.length)];
      const number = 100 + Math.floor(Math.random() * 900);
      const callsign = `${prefix}${number}`;
      const origin = AIRPORT_NAMES[Math.floor(Math.random() * AIRPORT_NAMES.length)];

      this.flights.push({
        callsign,
        origin,
        altitude: Math.round(5000 + Math.random() * 12000),
        speed: Math.round(180 + Math.random() * 120),
        heading: Math.round(Math.random() * 360),
        x: Math.round(Math.random() * 30),
        y: Math.round(Math.random() * 30),
        state: i % 2 === 0 ? 'approach' : 'holding',
        statusMessage: 'Tracking inbound traffic',
        danger: false,
      });
    }
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
