import type { Flight } from '../types.js';
import { AIRPORT_X, AIRPORT_Y, COLLISION_DISTANCE_UNITS, DANGER_DISTANCE_UNITS, GRID_MAX_COORDINATE, GRID_MIN_COORDINATE, RUNWAY_HEADING_TOLERANCE_DEGREES } from './constants.js';
import { AIRBORNE_STATES } from './movement.js';

/** Flags close-proximity conflicts and mid-air collisions; returns flights that crashed on this tick. */
export function detectDanger(flights: Flight[]): Flight[] {
  const newlyCrashed = new Set<Flight>();

  for (let firstIndex = 0; firstIndex < flights.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < flights.length; secondIndex += 1) {
      const first = flights[firstIndex];
      const second = flights[secondIndex];
      if (first.state === 'crashed' || second.state === 'crashed') continue;

      const dx = first.x - second.x;
      const dy = first.y - second.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < COLLISION_DISTANCE_UNITS && AIRBORNE_STATES.has(first.state) && AIRBORNE_STATES.has(second.state)) {
        newlyCrashed.add(first);
        newlyCrashed.add(second);
      } else if (distance < DANGER_DISTANCE_UNITS) {
        first.danger = true;
        second.danger = true;
        first.statusMessage = 'Conflict alert';
        second.statusMessage = 'Conflict alert';
      }
    }
  }

  for (const flight of newlyCrashed) {
    flight.state = 'crashed';
    flight.danger = true;
    flight.statusMessage = 'Mid-air collision';
  }

  return [...newlyCrashed];
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

function headingToAirport(flight: Flight): number {
  const deltaX = AIRPORT_X - flight.x;
  const deltaY = AIRPORT_Y - flight.y;
  if (deltaX === 0 && deltaY === 0) return flight.heading;

  return (Math.atan2(deltaX, deltaY) * 180 / Math.PI + 360) % 360;
}

export function isHeadingTowardAirport(flight: Flight): boolean {
  const deltaX = AIRPORT_X - flight.x;
  const deltaY = AIRPORT_Y - flight.y;
  if (deltaX === 0 && deltaY === 0) return true;

  const difference = Math.abs(((flight.heading - headingToAirport(flight) + 540) % 360) - 180);
  return difference <= RUNWAY_HEADING_TOLERANCE_DEGREES;
}

export function canBeAssignedRunway(flight: Flight): boolean {
  return getRunwayAssignmentIssues(flight).length === 0;
}

/** Explains why a flight isn't eligible for runway assignment yet, for surfacing to the controller. */
export function getRunwayAssignmentIssues(flight: Flight): string[] {
  const issues: string[] = [];

  if (!isHeadingTowardAirport(flight)) {
    const targetHeading = Math.round(headingToAirport(flight));
    issues.push(`heading is ${Math.round(flight.heading)}° but needs to be near ${targetHeading}° toward the airport`);
  }
  if (flight.speedTrend !== 'decreasing') {
    issues.push(`speed is ${Math.round(flight.speed)} kt and ${flight.speedTrend}, not decreasing`);
  }
  if (flight.altitudeTrend !== 'decreasing') {
    issues.push(`altitude is ${Math.round(flight.altitude)} ft and ${flight.altitudeTrend}, not decreasing`);
  }

  return issues;
}

/** Pulls airborne flights that strayed to the airspace boundary back toward the airport; returns flights that were redirected. */
export function redirectFlightsAtBoundary(flights: Flight[]): Flight[] {
  const redirected: Flight[] = [];

  for (const flight of flights) {
    if (!AIRBORNE_STATES.has(flight.state)) continue;
    const atEdge = flight.x <= GRID_MIN_COORDINATE || flight.x >= GRID_MAX_COORDINATE
      || flight.y <= GRID_MIN_COORDINATE || flight.y >= GRID_MAX_COORDINATE;
    if (!atEdge) continue;

    flight.x = Math.min(Math.max(flight.x, GRID_MIN_COORDINATE), GRID_MAX_COORDINATE);
    flight.y = Math.min(Math.max(flight.y, GRID_MIN_COORDINATE), GRID_MAX_COORDINATE);
    flight.heading = Math.round(headingToAirport(flight));
    flight.danger = true;
    flight.statusMessage = 'Lost near airspace boundary - redirected to airport';
    redirected.push(flight);
  }

  return redirected;
}
