export type FlightState =
  | 'approach'
  | 'holding'
  | 'climbing'
  | 'descending'
  | 'landing'
  | 'gated'
  | 'landed'
  | 'crashed'
  | 'taxiing'
  | 'final';

export type FlightTrend = 'increasing' | 'decreasing' | 'steady';

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
  statusMessage: string;
  danger: boolean;
  speedTrend: FlightTrend;
  altitudeTrend: FlightTrend;
  approachRunway?: string;
}

export interface ActiveCommand {
  id: number;
  callsign: string;
  description: string;
  progress: number;
}

export interface CommandResult {
  ok: boolean;
  message: string;
}
