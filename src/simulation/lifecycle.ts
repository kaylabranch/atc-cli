import type { Flight } from '../types.js';
import { TAXI_TO_GATE_DURATION_MS, UNLOAD_DURATION_MS } from './constants.js';
import type { PendingCommand } from './pendingCommands.js';
import { PendingCommands } from './pendingCommands.js';

type LifecycleContext = {
  findFlight: (callsign: string) => Flight | undefined;
  flights: Flight[];
  pendingCommands: PendingCommands;
  isRunwayAvailable: (runway: string, excludedCallsign: string) => boolean;
  markCompleted: (callsign: string) => void;
};

export function applyPendingCommand(command: PendingCommand, context: LifecycleContext): void {
  const flight = context.findFlight(command.callsign);
  if (!flight) return;

  switch (command.action) {
    case 'speed':
      flight.speedTrend = trendOf(command.startValue ?? flight.speed, command.target as number);
      flight.speed = command.target as number;
      flight.statusMessage = `Speed adjusted to ${flight.speed} kt`;
      break;
    case 'heading':
      flight.heading = command.target as number;
      flight.statusMessage = `Heading adjusted to ${flight.heading}°`;
      break;
    case 'altitude':
      flight.altitudeTrend = trendOf(command.startValue ?? flight.altitude, command.target as number);
      flight.altitude = command.target as number;
      flight.statusMessage = `Altitude adjusted to ${flight.altitude} ft`;
      break;
    case 'gate':
      flight.gate = command.target as string;
      flight.runway = undefined;
      flight.state = 'taxiing';
      flight.statusMessage = `Taxiing to gate ${flight.gate}`;
      context.pendingCommands.add(flight, 'taxi-to-gate', flight.gate, `Taxiing to gate ${flight.gate}`, TAXI_TO_GATE_DURATION_MS);
      break;
    case 'taxi-to-gate':
      flight.state = 'gated';
      flight.statusMessage = `Assigned to gate ${flight.gate}`;
      context.pendingCommands.add(flight, 'unload', flight.gate ?? '', 'Unloading passengers', UNLOAD_DURATION_MS);
      break;
    case 'runway':
      if (context.isRunwayAvailable(command.target as string, flight.callsign)) {
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
    case 'unload':
      context.markCompleted(flight.callsign);
      context.flights.splice(context.flights.indexOf(flight), 1);
      break;
  }
}

function trendOf(currentValue: number, targetValue: number): Flight['speedTrend'] {
  if (targetValue < currentValue) return 'decreasing';
  if (targetValue > currentValue) return 'increasing';
  return 'steady';
}
