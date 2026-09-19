import { colorLabels, progressBar } from './color.js';
import type { ActiveCommand, Flight } from '../types.js';

const { danger, warning, success, info, accent, bold } = colorLabels();

export function renderAirportLayout(flights: Flight[], runways: number, gates: number): string {
  const runwayLabel = Array.from({ length: runways }, (_, index) => `RWY${index + 1}`).join('     ');
  const gateLabel = Array.from({ length: gates }, (_, index) => `G${index + 1}`).join('  ');
  const flightText = flights
    .map((flight) => `${flight.callsign}:${flight.state}:${flight.x.toFixed(1)},${flight.y.toFixed(1)}`)
    .join(' | ');

  return [
    bold('AIRPORT LAYOUT'),
    `${accent('Runways:')} ${runwayLabel}`,
    `${accent('Gates:')} ${gateLabel}`,
    '-------------------------------',
    `Flights: ${flightText || 'none'}`,
    '-------------------------------',
  ].join('\n');
}

export function renderStatusBoard(flights: Flight[], activeFlights: number, dangerFlights: number, landedFlights: number): string {
  const lines = [
    `${bold('ATC STATUS')}`,
    `${info(`Active flights: ${activeFlights}`)} | ${danger(`Danger: ${dangerFlights}`)} | ${success(`Landed: ${landedFlights}`)}`,
    '',
    'CALLSIGN   STATE        ALT   SPD   HDG   RWY',
    '----------------------------------------------',
  ];

  for (const flight of flights) {
    const stateText =
      flight.danger ? danger(flight.state.toUpperCase()) :
      flight.state === 'landed' || flight.state === 'gated' ? success(flight.state.toUpperCase()) :
      flight.state === 'holding' || flight.state === 'approach' ? warning(flight.state.toUpperCase()) :
      info(flight.state.toUpperCase());

    const runwayText = flight.runway ?? '-';
    lines.push(
      `${flight.callsign.padEnd(9)} ${stateText.padEnd(12)} ${String(flight.altitude).padStart(5)} ${String(flight.speed).padStart(4)} ${String(flight.heading).padStart(4)} ${runwayText.padEnd(4)}`
    );
  }

  return lines.join('\n');
}

export function renderActiveCommands(commands: ActiveCommand[]): string {
  const lines = ['IN PROGRESS'];

  if (!commands.length) {
    lines.push('  None');
    return lines.join('\n');
  }

  for (const command of commands) {
    lines.push(`  #${command.id} ${command.callsign} ${command.description} ${progressBar(command.progress, 16)}`);
  }

  return lines.join('\n');
}

export function renderFlightDetail(flight: Flight): string {
  const stateText =
    flight.danger ? danger(flight.state.toUpperCase()) :
    flight.state === 'landed' || flight.state === 'gated' ? success(flight.state.toUpperCase()) :
    flight.state === 'holding' || flight.state === 'approach' ? warning(flight.state.toUpperCase()) :
    info(flight.state.toUpperCase());

  return [
    bold(`Flight ${flight.callsign}`),
    `State: ${stateText}`,
    `Origin: ${flight.origin}`,
    `Altitude: ${flight.altitude} ft`,
    `Speed: ${flight.speed} kt`,
    `Heading: ${flight.heading}°`,
    `Gate: ${flight.gate ?? 'none'}`,
    `Runway: ${flight.runway ?? 'none'}`,
    `Status: ${flight.statusMessage}`,
  ].join('\n');
}
