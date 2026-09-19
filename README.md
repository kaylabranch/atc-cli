# ✈️ ATC CLI Simulation

A terminal-based Air Traffic Control simulation written in TypeScript and Node.js. The user controls flights from a command-line REPL, monitors their state, assigns runways and gates, and manages traffic in a simplified airport environment.

## Features

- Altitude cross-section showing height versus distance from the airport

The altitude chart's horizontal axis uses simulation grid units, not miles. Distance is the straight-line distance from the airport reference point.
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

  The simulation uses a fixed 1000 ms display refresh interval for now.

3. Use commands such as:

   ```text
   help
   status all
   speed UAL123 240
   heading UAL123 180
   altitude UAL123 12000
    gate UAL123 A1
    runway UAL123 77L
   clear-to-land UAL123
   hold UAL123 left
   pause
   resume
   exit
   ```

### Interactive command entry

An empty prompt shows a dim italic `callsign command value` placeholder; it is visual guidance only and disappears when you type.

When entering a callsign, type its first few characters and press `Tab` to complete it.

Flight instructions use callsign-first commands:

  ```text
  UAL123 speed 240
  UAL123 heading 180
  UAL123 altitude 12000
  UAL123 gate A1
  UAL123 runway 77L
  UAL123 runway 77L
  UAL123 clear-to-land
  UAL123 abort-landing
  UAL123 hold left
  ```

To choose a flight command without typing its name, enter a callsign followed by a space, such as `UAL123 `. A compact popup appears below the prompt. Type a command prefix to filter it, such as `UAL123 h` for `heading` and `hold`, or `UAL123 hea` for `heading`. Press `Enter` or `Tab` to accept the highlighted match; the command is inserted into the prompt with a trailing space, ready for its value.

## Configuration

Run `npm run dev -- --help` to see all startup options. The simulation uses one standard speed model for all sessions:

```bash
npm run clock-in
```

The airport always uses 2 runways (`77L`, `77R`) and 3 gates (`A1`, `A2`, `A3`). The simulation starts with 3 flights and uses a fixed 1000 ms display update interval. The status table includes runway and gate assignments. Display updates do not move aircraft; flight changes happen through controller commands.

Landing takes 15 seconds. During landing, altitude and speed decrease toward zero. Use `abort-landing` while a flight is landing to cancel the descent and climb back toward its pre-landing altitude and speed.

Assign a runway before clearing a flight to land. For example, use `UAL123 runway 77L`, wait for the assignment to complete, then use `UAL123 clear-to-land`.

Only one flight may occupy a runway at a time. A runway is released when its flight begins taxiing to a gate and can then be assigned to another flight.

Command progress uses measured elapsed time between ticks. For example, changing speed by 100 knots at 5 knots per second takes 20 seconds, even if a display tick is delayed.

When running in an interactive terminal, the dashboard refreshes in place and keeps the current command line intact while controller commands are in progress. Commands are applied to a flight only when their progress reaches 100%. After landing, assign a gate; the aircraft taxis to that gate for 10 seconds, then unloads passengers for 10 seconds before leaving the simulation.

The game ends when all three starting flights are completed or crashed. A flight counts as completed only after it has been removed from the board. New-flight generation is not enabled yet.


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

## Future Enhancements

- Generate replacement flights over time after the initial three-flight session.
- Add explicit aircraft movement commands and more detailed position tracking.
- Expand collision, proximity, and crash scenarios with clearer recovery actions.
- Add runway and gate occupancy management as traffic volume grows.
- Improve ATC phraseology and add more command validation guidance.
