export type FlightState =
  | 'approach'
  | 'holding'
  | 'climbing'
  | 'descending'
  | 'gated'
  | 'landed'
  | 'crashed'
  | 'taxiing'
  | 'final';

export interface Flight {
  callsign: string;
  origin: string;
  altitude: number;
  speed: number;
  heading: number;
  x: number;
  y: number;
  gate?: string;
  runway?: string;
  state: FlightState;
  progress: number;
  statusMessage: string;
  danger: boolean;
  approachRunway?: string;
}

export interface SimulationOptions {
  runways?: number;
  gates?: number;
  tickMs?: number;
  flightCount?: number;
}

export interface CommandResult {
  ok: boolean;
  message: string;
}
