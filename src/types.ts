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
