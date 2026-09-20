import type { Flight } from '../types.js';

export function detectDanger(flights: Flight[]): void {
  for (let firstIndex = 0; firstIndex < flights.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < flights.length; secondIndex += 1) {
      const first = flights[firstIndex];
      const second = flights[secondIndex];
      const dx = first.x - second.x;
      const dy = first.y - second.y;

      if (Math.sqrt(dx * dx + dy * dy) < 3) {
        first.danger = true;
        second.danger = true;
        first.statusMessage = 'Conflict alert';
        second.statusMessage = 'Conflict alert';
      }
    }
  }
}

export function isRunwayAvailable(flights: Flight[], commands: { action: string; callsign: string; target: string | number }[], runway: string, excludedCallsign: string): boolean {
  const assignedToOtherFlight = flights.some(
    (flight) => flight.callsign !== excludedCallsign
      && flight.runway === runway
      && flight.state !== 'taxiing'
      && flight.state !== 'gated',
  );
  const pendingForOtherFlight = commands.some(
    (command) => command.action === 'runway'
      && command.callsign !== excludedCallsign
      && command.target === runway,
  );

  return !assignedToOtherFlight && !pendingForOtherFlight;
}
