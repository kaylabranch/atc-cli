import { colorLabels, progressBar } from './color.js';
import type { ActiveCommand, Flight } from '../types.js';

const { danger, warning, success, info, accent, bold } = colorLabels();
const GRID_WIDTH = 31;
const GRID_HEIGHT = 16;
const GRID_MAX_COORDINATE = 30;
const AIRPORT_X = 16;
const AIRPORT_Y = 16;
const ANSI_STYLE_PATTERN = /\u001b\[[0-9;]*m/g;
const ALTITUDE_CHART_WIDTH = 24;
const ALTITUDE_CHART_HEIGHT = 9;
const ALTITUDE_CHART_MAX = 18000;
const DISTANCE_CHART_MAX = 25;

export function renderAirportLayout(runways: number, gates: number): string {
  const runwayNames = ['77L', '77R'];
  const gateNames = ['A1', 'A2', 'A3'];
  const runwayLabel = runwayNames.slice(0, runways).join('     ');
  const gateLabel = gateNames.slice(0, gates).join('  ');

  return [
    bold('AIRPORT LAYOUT'),
    `${accent('Runways:')} ${runwayLabel}`,
    `${accent('Gates:')} ${gateLabel}`,
  ].join('\n');
}

export function renderGridPositions(flights: Flight[]): string {
  const cells = Array.from({ length: GRID_HEIGHT }, () => Array.from({ length: GRID_WIDTH }, () => ' '));
  const markers = new Map<string, string>();
  const usedMarkers = new Set(['X', '*']);

  const airportRow = Math.round((AIRPORT_Y / GRID_MAX_COORDINATE) * (GRID_HEIGHT - 1));
  cells[airportRow][AIRPORT_X] = 'X';

  for (const flight of flights) {
    const marker = [...flight.callsign].reverse().find((character) => !usedMarkers.has(character)) ?? '?';
    usedMarkers.add(marker);
    const x = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(flight.x)));
    const y = Math.max(0, Math.min(GRID_MAX_COORDINATE, Math.round(flight.y)));
    const row = Math.round((y / GRID_MAX_COORDINATE) * (GRID_HEIGHT - 1));
    if (cells[row][x] === ' ') {
      cells[row][x] = marker;
    } else if (cells[row][x] !== 'X') {
      cells[row][x] = '*';
    }
    markers.set(marker, `${marker}=${flight.callsign}`);
  }

  const border = `    +${'-'.repeat(GRID_WIDTH)}+`;
  const gridLines = [bold('GRID POSITIONS'), 'Legend: X=airport, *=multiple flights', border];

  for (let row = GRID_HEIGHT - 1; row >= 0; row -= 1) {
    const y = Math.round((row / (GRID_HEIGHT - 1)) * GRID_MAX_COORDINATE);
    gridLines.push(`${String(y).padStart(3)} |${cells[row].join('')}|`);
  }

  gridLines.push(border, '      0         10        20        30');
  gridLines.push(`Flights: ${Array.from(markers.values()).join(' | ') || 'none'}`);

  return gridLines.join('\n');
}

export function renderAltitudeChart(flights: Flight[]): string {
  const chart = Array.from({ length: ALTITUDE_CHART_HEIGHT }, () => Array.from({ length: ALTITUDE_CHART_WIDTH + 1 }, () => ' '));
  const markers: string[] = [];
  const usedMarkers = new Set(['*']);

  for (const flight of flights) {
    const marker = [...flight.callsign].reverse().find((character) => !usedMarkers.has(character)) ?? '?';
    usedMarkers.add(marker);
    const distance = Math.sqrt((flight.x - AIRPORT_X) ** 2 + (flight.y - AIRPORT_Y) ** 2);
    const chartDistance = Math.min(DISTANCE_CHART_MAX, Math.max(0, distance));
    const column = Math.round((chartDistance / DISTANCE_CHART_MAX) * ALTITUDE_CHART_WIDTH) + 1;
    const altitude = Math.min(ALTITUDE_CHART_MAX, Math.max(0, flight.altitude));
    const row = ALTITUDE_CHART_HEIGHT - 1 - Math.round((altitude / ALTITUDE_CHART_MAX) * (ALTITUDE_CHART_HEIGHT - 1));
    chart[row][column] = chart[row][column] === ' ' ? marker : '*';
    markers.push(`${marker}=${flight.callsign} ${Math.round(flight.altitude)}ft/${Math.round(distance)}u`);
  }

  const lines = [bold('ALTITUDE CROSS-SECTION'), 'Height vs. distance from airport', `     ${'-'.repeat(ALTITUDE_CHART_WIDTH + 1)}`];
  for (let row = 0; row < ALTITUDE_CHART_HEIGHT; row += 1) {
    const altitude = Math.round(ALTITUDE_CHART_MAX - (row / (ALTITUDE_CHART_HEIGHT - 1)) * ALTITUDE_CHART_MAX);
    lines.push(`${String(altitude).padStart(5)} |${chart[row].join('')}`);
  }
  lines.push(`    0 +${'-'.repeat(ALTITUDE_CHART_WIDTH)}>`);
  lines.push('      0       5       10      15      20      25u');
  lines.push(`Flights: ${markers.join(' | ') || 'none'}`);

  return lines.join('\n');
}

export function renderSideBySide(left: string, right: string, gap = 4): string {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const leftWidth = Math.max(...leftLines.map((line) => line.replace(ANSI_STYLE_PATTERN, '').length));
  const lineCount = Math.max(leftLines.length, rightLines.length);
  const lines: string[] = [];

  for (let index = 0; index < lineCount; index += 1) {
    const leftLine = leftLines[index] ?? '';
    const rightLine = rightLines[index] ?? '';
    const visibleLeftWidth = leftLine.replace(ANSI_STYLE_PATTERN, '').length;
    lines.push(`${leftLine}${' '.repeat(leftWidth - visibleLeftWidth + gap)}${rightLine}`.trimEnd());
  }

  return lines.join('\n');
}

export function renderStatusBoard(flights: Flight[], activeFlights: number, dangerFlights: number, completedFlights: number): string {
  const lines = [
    `${bold('ATC STATUS')}`,
    `${info(`Active flights: ${activeFlights}`)} | ${danger(`Needs attention: ${dangerFlights}`)} | ${success(`Completed: ${completedFlights}`)}`,
    '',
    `${'CALLSIGN'.padEnd(10)} ${'STATE'.padEnd(12)} ${'ALT'.padStart(6)} ${'SPD'.padStart(6)} ${'HDG'.padStart(6)} ${'RWY'.padStart(6)} ${'GATE'.padStart(6)}`,
    '-------------------------------------------------------------',
  ];

  for (const flight of flights) {
    const stateValue = flight.state.toUpperCase().padEnd(12);
    const stateText =
      flight.danger ? danger(stateValue) :
      flight.state === 'landed' || flight.state === 'gated' ? success(stateValue) :
      flight.state === 'holding' || flight.state === 'approach' || flight.state === 'landing' ? warning(stateValue) :
      info(stateValue);

    const runwayText = (flight.runway ?? '-').padStart(6);
    const gateText = (flight.gate ?? '-').padStart(6);
    lines.push(
      `${flight.callsign.padEnd(10)} ${stateText} ${String(Math.round(flight.altitude)).padStart(6)} ${String(Math.round(flight.speed)).padStart(6)} ${String(Math.round(flight.heading)).padStart(6)} ${runwayText} ${gateText}`
    );
  }

  return lines.join('\n');
}

export function renderActiveCommands(commands: ActiveCommand[]): string {
  const lines = ['IN PROGRESS'];

  if (!commands.length) {
    lines.push('No commands in progress.');
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
    flight.state === 'holding' || flight.state === 'approach' || flight.state === 'landing' ? warning(flight.state.toUpperCase()) :
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
