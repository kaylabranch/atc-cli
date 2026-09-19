# ATC CLI Simulation

A terminal-based Air Traffic Control simulation written in TypeScript and Node.js. The user controls flights from a command-line REPL, monitors their state, assigns runways and gates, and manages traffic in a simplified airport environment.

## Features

- REPL-driven command interface
- Randomized flight generation with unique callsigns
- Configurable runways, gates, flight count, and sim tick rate
- Real-time ATC status board
- ASCII airport layout
- Speed, heading, altitude, gate, runway, and landing controls
- Collision and danger detection
- Pause/resume and clean exit support
- Colorized terminal output with fallbacks for non-TTY terminals

## Tech stack

- TypeScript
- Node.js
- Vitest
- tsx

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the simulator:

   ```bash
   npm run dev
   ```

3. Use commands such as:

   ```text
   help
   status all
   speed UAL123 240
   heading UAL123 180
   altitude UAL123 12000
   gate UAL123 A1
   runway UAL123 27L
   clear-to-land UAL123
   hold UAL123 left
   pause
   resume
   exit
   ```

## Configuration

You can start with custom settings:

```bash
npm run dev -- --runways 3 --gates 5 --flight-count 4 --tick-ms 500
```

## Project structure

```text
src/
  cli/
    color.ts
    commandParser.ts
    renderer.ts
  simulation/
    Simulation.ts
  index.ts
  types.ts

tests/
  simulation.test.ts
```

## Notes

- Climb and descent rates are modeled around 1500 ft/min.
- Speed adjustments are capped to 50 knots per second.
- Turn rate is capped to 3 degrees per second.
- Departures and takeoffs are intentionally out of scope for this version.
