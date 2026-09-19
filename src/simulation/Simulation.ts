import { parseCommand } from '../cli/commandParser.js';
import { renderActiveCommands, renderAirportLayout, renderFlightDetail, renderStatusBoard } from '../cli/renderer.js';
import type { ActiveCommand, CommandResult, Flight, SimulationOptions } from '../types.js';

const AIRPORT_NAMES = ['KJFK', 'KSFO', 'KDEN', 'KSEA', 'PHX'];
const AIRLINE_PREFIXES = ['UAL', 'DLH', 'BAW', 'SWA', 'AAL', 'NKS'];
type PendingAction = 'speed' | 'heading' | 'altitude' | 'gate' | 'runway' | 'clear-to-land' | 'hold';
type PendingCommand = ActiveCommand & {
  action: PendingAction;
  target: string | number;
  durationMs: number;
  elapsedMs: number;
};

export class Simulation {
  private flights: Flight[] = [];
  private paused = false;
  private running = true;
  private readonly runways: number;
  private readonly gates: number;
  private readonly tickMs: number;
  private readonly maxFlights: number;
  private pendingCommands: PendingCommand[] = [];
  private nextCommandId = 1;

  constructor({ runways = 2, gates = 4, tickMs = 1000, flightCount = 3 }: SimulationOptions = {}) {
    this.runways = runways;
    this.gates = gates;
    this.tickMs = tickMs;
    this.maxFlights = flightCount;
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
    return this.tickMs;
  }

  getActiveCommands(): ActiveCommand[] {
    return this.pendingCommands.map(({ id, callsign, description, progress }) => ({ id, callsign, description, progress }));
  }

  isPaused(): boolean {
    return this.paused;
  }

  isRunning(): boolean {
    return this.running;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  stop(): void {
    this.running = false;
    this.paused = true;
  }

  step(elapsedMilliseconds = this.tickMs): void {
    if (!this.running || this.paused) return;
    for (const command of this.pendingCommands) {
      command.elapsedMs += elapsedMilliseconds;
      command.progress = Math.min(100, Math.round((command.elapsedMs / command.durationMs) * 100));
    }

    const completedCommands = this.pendingCommands.filter((command) => command.progress >= 100);
    this.pendingCommands = this.pendingCommands.filter((command) => command.progress < 100);
    for (const command of completedCommands) {
      this.applyPendingCommand(command);
    }

    this.detectDanger();
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
    const landedFlights = this.flights.filter((flight) => flight.state === 'landed' || flight.state === 'gated').length;
    return renderStatusBoard(this.flights, activeFlights, dangerFlights, landedFlights);
  }

  renderAirportLayout(): string {
    return renderAirportLayout(this.flights, this.runways, this.gates);
  }

  renderActiveCommands(): string {
    return renderActiveCommands(this.getActiveCommands());
  }

  private handleStatus(args: string[]): CommandResult {
    if (!args.length || args[0] === 'all') {
      return { ok: true, message: `${this.renderStatusBoard()}\n\n${this.renderAirportLayout()}` };
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

    return this.queueCommand(flight, 'gate', gate, `Gate assignment ${gate}`, 2000);
  }

  private handleRunway(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: runway <callsign> <runway>' };
    const [callsign, runway] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    return this.queueCommand(flight, 'runway', runway, `Runway assignment ${runway}`, 2000);
  }

  private handleClearToLand(args: string[]): CommandResult {
    if (!args.length) return { ok: false, message: 'Usage: clear-to-land <callsign>' };

    const flight = this.getFlight(args[0]);
    if (!flight) return { ok: false, message: `No flight found with callsign ${args[0]}.` };

    return this.queueCommand(flight, 'clear-to-land', '', 'Clear to land', 3000);
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
        flight.state = 'gated';
        flight.statusMessage = `Assigned to gate ${flight.gate}`;
        break;
      case 'runway':
        flight.runway = command.target as string;
        flight.statusMessage = `Assigned to runway ${flight.runway}`;
        break;
      case 'clear-to-land':
        flight.state = 'approach';
        flight.statusMessage = 'Cleared to land';
        flight.danger = false;
        break;
      case 'hold':
        flight.state = 'holding';
        flight.statusMessage = `Holding ${command.target as string} pattern`;
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

  private generateFlights(): void {
    const flightCount = Math.min(this.maxFlights, 8);

    for (let i = 0; i < flightCount; i += 1) {
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
