import type { Flight } from '../types.js';

const MILLISECONDS_PER_HOUR = 3_600_000;
export const AIRBORNE_STATES = new Set(['approach', 'holding', 'climbing', 'descending', 'landing', 'final']);

export function advanceFlightMovement(flights: Flight[], elapsedMilliseconds: number): void {
  const elapsedHours = elapsedMilliseconds / MILLISECONDS_PER_HOUR;

  for (const flight of flights) {
    if (!AIRBORNE_STATES.has(flight.state) || flight.speed <= 0) continue;

    const distance = flight.speed * elapsedHours;
    const headingRadians = (flight.heading * Math.PI) / 180;
    flight.x += Math.sin(headingRadians) * distance;
    flight.y += Math.cos(headingRadians) * distance;
  }
}
