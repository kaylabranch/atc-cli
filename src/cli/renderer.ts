import { colorLabels, progressBar } from './color.js';
import type { ActiveCommand, Flight } from '../types.js';

const { danger, warning, success, info, accent, bold } = colorLabels();

export function renderAirportLayout(flights: Flight[], runways: number, gates: number): string {
  const runwayNames = ['77L', '77R'];
  const gateNames = ['A1', 'A2', 'A3'];
  const runwayLabel = runwayNames.slice(0, runways).join('     ');
  const gateLabel = gateNames.slice(0, gates).join('  ');
  const flightText = flights
    .map((flight) => `${flight.callsign}:${flight.state},${Math.round(flight.x)},${Math.round(flight.y)}`)
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
    `${'CALLSIGN'.padEnd(10)} ${'STATE'.padEnd(12)} ${'ALT'.padStart(6)} ${'SPD'.padStart(6)} ${'HDG'.padStart(6)} ${'RWY'.padStart(6)}`,
    '------------------------------------------------------',
  ];

  for (const flight of flights) {
    const stateValue = flight.state.toUpperCase().padEnd(12);
    const stateText =
      flight.danger ? danger(stateValue) :
      flight.state === 'landed' || flight.state === 'gated' ? success(stateValue) :
      flight.state === 'holding' || flight.state === 'approach' ? warning(stateValue) :
      info(stateValue);

    const runwayText = (flight.runway ?? '-').padStart(6);
    lines.push(
      `${flight.callsign.padEnd(10)} ${stateText} ${String(Math.round(flight.altitude)).padStart(6)} ${String(Math.round(flight.speed)).padStart(6)} ${String(Math.round(flight.heading)).padStart(5)} ${runwayText}`
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
