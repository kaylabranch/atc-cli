# ATC CLI Simulation

A terminal-based Air Traffic Control simulation written in TypeScript and Node.js. The user controls flights from a command-line REPL, monitors their state, assigns runways and gates, and manages traffic in a simplified airport environment.

## Features

- REPL-driven command interface
- Randomized flight generation with unique callsigns
- Configurable runways, gates, flight count, and sim tick rate
- Real-time ATC status board
- In-place terminal updates that preserve typed input
- Pending command list with progress tracking
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

  Or use the package script with an ATC-style phrase:

  ```bash
  npm run clock-in
  ```

  Configuration flags can follow the script, for example `npm run clock-in -- --runways 3`.

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

Run `npm run dev -- --help` to see all startup options. The simulation uses one standard speed model for all sessions:

```bash
npm run dev -- --runways 3 --gates 5 --flight-count 4 --tick-ms 500
```

The default simulation uses 2 runways, 4 gates, 3 flights, and a 1000 ms display update interval. The `--tick-ms` option changes display refresh frequency only. Display updates do not move aircraft; flight changes happen through controller commands.

Command progress uses measured elapsed time between ticks. For example, changing speed by 100 knots at 5 knots per second takes 20 seconds, even if a display tick is delayed.

When running in an interactive terminal, the dashboard refreshes in place and keeps the current command line intact while controller commands are in progress. Commands are applied to a flight only when their progress reaches 100%.


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
- Speed commands complete at a rate of 5 knots per second.
- Heading commands complete at a turn rate of 3 degrees per second.
- Departures and takeoffs are intentionally out of scope for this version.
