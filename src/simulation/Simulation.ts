import { parseCommand } from '../cli/commandParser.js';
import { renderAirportLayout, renderFlightDetail, renderStatusBoard } from '../cli/renderer.js';
import type { CommandResult, Flight, SimulationOptions } from '../types.js';

const AIRPORT_NAMES = ['KJFK', 'KSFO', 'KDEN', 'KSEA', 'PHX'];
const AIRLINE_PREFIXES = ['UAL', 'DLH', 'BAW', 'SWA', 'AAL', 'NKS'];

export class Simulation {
  private flights: Flight[] = [];
  private paused = false;
  private running = true;
  private readonly runways: number;
  private readonly gates: number;
  private readonly tickMs: number;
  private readonly maxFlights: number;

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

  step(): void {
    if (!this.running || this.paused) return;

    const dangerFlights = this.flights.filter((flight) => flight.danger);
    if (dangerFlights.length > 0) {
      for (const flight of dangerFlights) {
        flight.altitude = Math.max(0, flight.altitude - 200);
        flight.speed = Math.max(90, flight.speed - 15);
        flight.statusMessage = 'Caution: proximity warning';
      }
    }

    for (const flight of this.flights) {
      if (flight.state === 'crashed' || flight.state === 'landed' || flight.state === 'gated') continue;

      flight.progress = Math.min(100, flight.progress + 10);
      flight.altitude = Math.max(0, flight.altitude + (flight.state === 'climbing' ? 1500 : -1500));
      flight.speed = Math.max(100, Math.min(400, flight.speed + (flight.state === 'holding' ? -5 : 2)));
      flight.heading = (flight.heading + 3) % 360;

      if (flight.altitude <= 0) {
        flight.state = 'crashed';
        flight.statusMessage = 'Crash report: aircraft lost control';
        flight.danger = true;
      }

      if (flight.progress >= 100) {
        flight.state = flight.state === 'approach' ? 'landed' : 'gated';
        flight.statusMessage = flight.state === 'landed' ? 'Touchdown complete' : 'Parked at gate';
        flight.progress = 100;
      }

      if (flight.state === 'holding') {
        flight.statusMessage = 'Holding pattern assigned';
      }
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

    const speed = Number(rawSpeed);
    if (Number.isNaN(speed)) return { ok: false, message: 'Speed must be a number.' };

    const delta = Math.abs(speed - flight.speed);
    if (delta > 50) return { ok: false, message: 'Speed changes are capped at 50 knots per second.' };

    flight.speed = speed;
    flight.statusMessage = `Speed adjusted to ${speed} kt`;
    return { ok: true, message: `${flight.callsign} now flying at ${speed} kt.` };
  }

  private handleHeading(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: heading <callsign> <degrees>' };
    const [callsign, rawHeading] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    const heading = Number(rawHeading);
    if (Number.isNaN(heading)) return { ok: false, message: 'Heading must be a number.' };

    const delta = Math.abs(heading - flight.heading);
    if (delta > 3) return { ok: false, message: 'Turn rate is capped at 3 degrees per second.' };

    flight.heading = heading;
    flight.statusMessage = `Heading adjusted to ${heading}°`;
    return { ok: true, message: `${flight.callsign} heading set to ${heading}°.` };
  }

  private handleAltitude(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: altitude <callsign> <feet>' };
    const [callsign, rawAltitude] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    const altitude = Number(rawAltitude);
    if (Number.isNaN(altitude)) return { ok: false, message: 'Altitude must be a number.' };

    const delta = Math.abs(altitude - flight.altitude);
    if (delta > 1500) return { ok: false, message: 'Altitude changes are capped at 1500 ft/min.' };

    flight.altitude = altitude;
    flight.statusMessage = `Altitude adjusted to ${altitude} ft`;
    return { ok: true, message: `${flight.callsign} altitude set to ${altitude} ft.` };
  }

  private handleGate(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: gate <callsign> <gate>' };
    const [callsign, gate] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    flight.gate = gate;
    flight.state = 'gated';
    flight.statusMessage = `Assigned to gate ${gate}`;
    return { ok: true, message: `${flight.callsign} assigned to gate ${gate}.` };
  }

  private handleRunway(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: runway <callsign> <runway>' };
    const [callsign, runway] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    flight.runway = runway;
    flight.statusMessage = `Assigned to runway ${runway}`;
    return { ok: true, message: `${flight.callsign} assigned to runway ${runway}.` };
  }

  private handleClearToLand(args: string[]): CommandResult {
    if (!args.length) return { ok: false, message: 'Usage: clear-to-land <callsign>' };

    const flight = this.getFlight(args[0]);
    if (!flight) return { ok: false, message: `No flight found with callsign ${args[0]}.` };

    flight.state = 'approach';
    flight.statusMessage = 'Cleared to land';
    flight.danger = false;
    return { ok: true, message: `${flight.callsign} cleared to land.` };
  }

  private handleHold(args: string[]): CommandResult {
    if (args.length < 2) return { ok: false, message: 'Usage: hold <callsign> <left|right>' };
    const [callsign, side] = args;
    const flight = this.getFlight(callsign);
    if (!flight) return { ok: false, message: `No flight found with callsign ${callsign}.` };

    flight.state = 'holding';
    flight.statusMessage = `Holding ${side} pattern`;
    return { ok: true, message: `${flight.callsign} instructed to hold ${side} pattern.` };
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
        altitude: 5000 + Math.random() * 12000,
        speed: 180 + Math.random() * 120,
        heading: Math.random() * 360,
        x: Math.random() * 30,
        y: Math.random() * 30,
        state: i % 2 === 0 ? 'approach' : 'holding',
        progress: 20 + Math.random() * 50,
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
