import { colorLabels, progressBar } from './color.js';
import type { ActiveCommand, Flight } from '../types.js';

const { danger, warning, success, info, accent, bold, muted } = colorLabels();
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

export function renderHelp(): string {
  const command = (text: string) => accent(text.padEnd(30));

  return [
    bold('ATC CLI HELP'),
    '',
    bold('General'),
    `  ${command('help')}Show this help`,
    `  ${command('close-help')}Dismiss this help text`,
    `  ${command('status [all|callsign]')}Show every flight, or details for one flight`,
    `  ${command('pause')}Pause the simulation clock`,
    `  ${command('resume')}Resume the simulation clock`,
    `  ${command('exit')}End the simulation`,
    '',
    bold('Flight commands'),
    muted('Use callsign-first order, just like real ATC phraseology: <callsign> <command> <value>.'),
    `  ${command('<callsign> speed <knots>')}Set target speed (120-600 kt); decreases at 5 kt/s, increases at 2.5 kt/s`,
    `  ${command('<callsign> heading <degrees>')}Set target heading (0-359°, 0=N); turns at 3°/s`,
    `  ${command('<callsign> altitude <feet>')}Set target altitude; climbs/descends at 250 ft/s`,
    `  ${command('<callsign> runway <77L|77R>')}Assign a runway; requires heading at the airport with decreasing speed and altitude`,
    `  ${command('<callsign> clear-to-land')}Begin a 15s landing; requires a completed runway assignment`,
    `  ${command('<callsign> abort-landing')}Cancel an active landing and climb back to altitude and speed`,
    `  ${command('<callsign> gate <A1|A2|A3>')}Assign a gate once landed; taxis 10s, then unloads 10s`,
    `  ${command('<callsign> hold <left|right>')}Enter an airborne holding pattern; currently follows its heading`,
    '',
    bold('Workflow'),
    `  ${warning('runway')} -> ${warning('clear-to-land')} -> wait for "landed" -> ${warning('gate')}`,
    '',
    bold('Tips'),
    `  ${muted('- Commands complete over time; watch the IN PROGRESS list for their progress.')}`,
    `  ${muted('- Flights highlighted in red need attention (conflict, stall, or collision risk).')}`,
    `  ${muted('- Type a callsign and press Tab or Enter to autocomplete it.')}`,
    '',
    bold('Examples'),
    '  UAL123 speed 240',
    '  UAL123 runway 77L',
    '  DLH202 clear-to-land',
    '  status all',
  ].join('\n');
}

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
  const airborneFlights = flights.filter((flight) => flight.state !== 'landed' && flight.state !== 'taxiing' && flight.state !== 'gated');
  const cells = Array.from({ length: GRID_HEIGHT }, () => Array.from({ length: GRID_WIDTH }, () => ' '));

  const airportRow = Math.round((AIRPORT_Y / GRID_MAX_COORDINATE) * (GRID_HEIGHT - 1));
  cells[airportRow][AIRPORT_X] = 'X';

  for (const [index, flight] of airborneFlights.entries()) {
    const marker = String(index + 1);
    const x = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(flight.x)));
    const y = Math.max(0, Math.min(GRID_MAX_COORDINATE, Math.round(flight.y)));
    const row = Math.round((y / GRID_MAX_COORDINATE) * (GRID_HEIGHT - 1));
    if (cells[row][x] === ' ') {
      cells[row][x] = marker;
    } else if (cells[row][x] !== 'X') {
      cells[row][x] = '*';
    }
  }

  const border = `    +${'-'.repeat(GRID_WIDTH)}+`;
  const gridLines = [bold('GRID POSITIONS'), muted('Legend: X=airport, *=multiple flights'), border];

  for (let row = GRID_HEIGHT - 1; row >= 0; row -= 1) {
    const y = Math.round((row / (GRID_HEIGHT - 1)) * GRID_MAX_COORDINATE);
    gridLines.push(`${String(y).padStart(3)} |${cells[row].join('')}|`);
  }

  gridLines.push(border, '      0         10        20        30');

  return gridLines.join('\n');
}

export function renderAltitudeChart(flights: Flight[]): string {
  const airborneFlights = flights.filter((flight) => flight.state !== 'landed' && flight.state !== 'taxiing' && flight.state !== 'gated');
  const chart = Array.from({ length: ALTITUDE_CHART_HEIGHT }, () => Array.from({ length: ALTITUDE_CHART_WIDTH + 1 }, () => ' '));

  for (const [index, flight] of airborneFlights.entries()) {
    const marker = String(index + 1);
    const distance = Math.sqrt((flight.x - AIRPORT_X) ** 2 + (flight.y - AIRPORT_Y) ** 2);
    const chartDistance = Math.min(DISTANCE_CHART_MAX, Math.max(0, distance));
    const column = Math.round((chartDistance / DISTANCE_CHART_MAX) * ALTITUDE_CHART_WIDTH) + 1;
    const altitude = Math.min(ALTITUDE_CHART_MAX, Math.max(0, flight.altitude));
    const row = ALTITUDE_CHART_HEIGHT - 1 - Math.round((altitude / ALTITUDE_CHART_MAX) * (ALTITUDE_CHART_HEIGHT - 1));
    chart[row][column] = chart[row][column] === ' ' ? marker : '*';
  }

  const lines = [bold('ALTITUDE CROSS-SECTION'), muted('Height vs. distance from airport'), `     ${'-'.repeat(ALTITUDE_CHART_WIDTH + 1)}`];
  for (let row = 0; row < ALTITUDE_CHART_HEIGHT; row += 1) {
    const altitude = Math.round(ALTITUDE_CHART_MAX - (row / (ALTITUDE_CHART_HEIGHT - 1)) * ALTITUDE_CHART_MAX);
    lines.push(`${String(altitude).padStart(5)} |${chart[row].join('')}`);
  }
  lines.push(`      +${'-'.repeat(ALTITUDE_CHART_WIDTH)}>`);
  lines.push(renderDistanceAxisLabels());

  return lines.join('\n');
}

function renderDistanceAxisLabels(): string {
  const prefixWidth = 7;
  const totalWidth = prefixWidth + ALTITUDE_CHART_WIDTH + 1;
  const chars = Array.from({ length: totalWidth }, () => ' ');

  for (let value = 0; value <= DISTANCE_CHART_MAX; value += 5) {
    const column = prefixWidth + Math.round((value / DISTANCE_CHART_MAX) * ALTITUDE_CHART_WIDTH);
    const label = String(value);
    const start = Math.min(column, totalWidth - label.length);
    for (let index = 0; index < label.length; index += 1) {
      chars[start + index] = label[index];
    }
  }

  return chars.join('');
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

export function renderStatusBoard(flights: Flight[], activeFlights: number, dangerFlights: number, completedFlights: number, crashedFlights = 0): string {
  const lines = [
    `${bold('ATC STATUS')}`,
    `${info(`Active flights: ${activeFlights}`)} | ${danger(`Needs attention: ${dangerFlights}`)} | ${success(`Completed: ${completedFlights}`)} | ${danger(`Crashed: ${crashedFlights}`)}`,
    '',
    `${'(ALIAS) CALLSIGN'.padEnd(18)} ${'STATE'.padEnd(12)} ${'ALT'.padStart(6)} ${'SPD'.padStart(6)} ${'HDG'.padStart(6)} ${'RWY'.padStart(6)} ${'GATE'.padStart(6)}`,
    '-------------------------------------------------------------',
  ];

  for (const [index, flight] of flights.entries()) {
    const stateValue = flight.state.toUpperCase().padEnd(12);
    const stateText =
      flight.danger ? danger(stateValue) :
        flight.state === 'landed' || flight.state === 'gated' ? success(stateValue) :
          flight.state === 'holding' || flight.state === 'approach' || flight.state === 'landing' ? warning(stateValue) :
            info(stateValue);

    const runwayText = (flight.runway ?? '-').padStart(6);
    const gateText = (flight.gate ?? '-').padStart(6);
    lines.push(
      `${`(${index + 1}) ${flight.callsign}`.padEnd(18)} ${stateText} ${String(Math.round(flight.altitude)).padStart(6)} ${String(Math.round(flight.speed)).padStart(6)} ${String(Math.round(flight.heading)).padStart(5)} ${runwayText} ${gateText}`
    );
  }

  return lines.join('\n');
}

export function renderActiveCommands(commands: ActiveCommand[]): string {
  const lines = ['IN PROGRESS'];

  if (!commands.length) {
    lines.push(muted('No commands in progress.'));
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

export function renderGameOverSummary(crashedFlights: number, totalFlights: number): string {
  const outcome = crashedFlights === 0
    ? {
      label: 'COMMENDATION - PROMOTED',
      message: 'Perfect safety record. Every flight landed safely - you have been promoted to Senior Controller.',
    }
    : crashedFlights === totalFlights
      ? {
        label: 'TERMINATED',
        message: `Every aircraft under your watch was lost (${crashedFlights}/${totalFlights}). You are fired, effective immediately.`,
      }
      : crashedFlights / totalFlights >= 0.5
        ? {
          label: 'SUSPENDED',
          message: `Multiple aircraft lost (${crashedFlights}/${totalFlights}). You have been placed on unpaid administrative leave pending review.`,
        }
        : {
          label: 'REPRIMANDED',
          message: `An aircraft was lost on your watch (${crashedFlights}/${totalFlights}). You have received a formal written reprimand and mandatory retraining.`,
        };

  const labelText = crashedFlights === 0 ? success(bold(outcome.label)) : danger(bold(outcome.label));

  return [
    bold('GAME OVER'),
    labelText,
    outcome.message,
  ].join('\n');
}
