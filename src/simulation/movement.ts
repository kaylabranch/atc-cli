import type { Flight } from '../types.js';
import { MOVEMENT_SPEED_MULTIPLIER } from './constants.js';

const MILLISECONDS_PER_HOUR = 3_600_000;
export const AIRBORNE_STATES = new Set(['approach', 'climbing', 'descending', 'landing', 'final']);

export function advanceFlightMovement(flights: Flight[], elapsedMilliseconds: number): void {
  const elapsedHours = elapsedMilliseconds / MILLISECONDS_PER_HOUR;

  for (const flight of flights) {
    if (!AIRBORNE_STATES.has(flight.state) || flight.speed <= 0) continue;

    const distance = flight.speed * elapsedHours * MOVEMENT_SPEED_MULTIPLIER;
    const headingRadians = (flight.heading * Math.PI) / 180;
    flight.x += Math.sin(headingRadians) * distance;
    flight.y += Math.cos(headingRadians) * distance;
  }
}
