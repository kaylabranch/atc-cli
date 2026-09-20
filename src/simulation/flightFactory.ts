import { AIRLINE_PREFIXES, AIRPORT_NAMES, STARTING_FLIGHT_COUNT } from './constants.js';
import type { Flight } from '../types.js';

export function generateFlights(): Flight[] {
  return Array.from({ length: STARTING_FLIGHT_COUNT }, (_, index) => {
    const prefix = AIRLINE_PREFIXES[Math.floor(Math.random() * AIRLINE_PREFIXES.length)];
    const number = 100 + Math.floor(Math.random() * 900);
    const callsign = `${prefix}${number}`;
    const origin = AIRPORT_NAMES[Math.floor(Math.random() * AIRPORT_NAMES.length)];

    return {
      callsign,
      origin,
      altitude: Math.round(5000 + Math.random() * 12000),
      speed: Math.round(180 + Math.random() * 120),
      heading: Math.round(Math.random() * 360),
      x: Math.round(Math.random() * 30),
      y: Math.round(Math.random() * 30),
      state: index % 2 === 0 ? 'approach' : 'holding',
      statusMessage: 'Tracking inbound traffic',
      danger: false,
    };
  });
}
