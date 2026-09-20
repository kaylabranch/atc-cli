# ✈️ ATC CLI Simulation

[_Work in Progress_] A terminal-based Air Traffic Control simulation written in TypeScript and Node.js. The user controls flights from a command-line REPL, monitors their state, assigns runways and gates, and manages traffic in a simplified airport environment.

## Features

- Command-line REPL for controlling 3 randomly generated flights with unique callsigns
- Speed, heading, altitude, gate, runway, clear-to-land, abort-landing, and hold commands, each represented as a pending operation with a progress bar
- Runway assignment validation with a detailed rejection message calling out exactly which condition (heading, speed trend, altitude trend) is unmet
- Full landing lifecycle: runway assignment, clearance to land, taxi to gate, and passenger unload before a flight leaves the board
- Conflict alerts for flights that stray too close together, and mid-air collisions for flights that get even closer
- Boundary redirection for flights that stray to the edge of the simulation grid
- Stall detection for airborne flights that lose all airspeed outside of a controlled landing
- A career outcome (promotion, reprimand, suspension, or termination) once the game ends, based on how many flights crashed
- Status board, airport layout, grid position map, and altitude cross-section, all refreshed in place

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

The airport always uses 2 runways (`77L`, `77R`) and 3 gates (`A1`, `A2`, `A3`). The simulation starts with 3 flights and uses a fixed 1000 ms display update interval. The status table includes runway and gate assignments. Airborne flights move continuously as time passes using their current speed and heading; headings use aviation convention (`0°` north, `90°` east). Landed, taxiing, and gated flights remain stationary.

Landing takes 15 seconds. During landing, altitude and speed decrease toward zero. Use `abort-landing` while a flight is landing to cancel the descent and climb back toward its pre-landing altitude and speed.

Assign a runway before clearing a flight to land. For example, use `UAL123 runway 77L`, wait for the assignment to complete, then use `UAL123 clear-to-land`.

A flight must be pointed toward the airport and must have completed both a decreasing-speed command and a decreasing-altitude command before a runway assignment is accepted. If a runway assignment is rejected, the response spells out exactly which condition(s) are unmet, including the flight's current heading, speed, and altitude.

Only one flight may occupy a runway at a time. A runway is released when its flight begins taxiing to a gate and can then be assigned to another flight.

Command progress uses measured elapsed time between ticks. For example, decreasing speed by 100 knots at 5 knots per second takes 20 seconds, while increasing speed by the same amount at 2.5 knots per second takes 40 seconds, even if a display tick is delayed.

When running in an interactive terminal, the dashboard refreshes in place and keeps the current command line intact while controller commands are in progress. Commands are applied to a flight only when their progress reaches 100%. After landing, assign a gate; the aircraft taxis to that gate for 10 seconds, then unloads passengers for 10 seconds before leaving the simulation.

The game ends when all three starting flights are completed or crashed. A flight counts as completed only after it has been removed from the board. New-flight generation is not enabled yet.

Aircraft that come dangerously close together (within 3 grid units) are flagged as a conflict alert. If two flights collide (within 1 grid unit) while airborne, both are marked as crashed and are counted toward the end-of-game outcome. When the game ends, the dashboard shows a career outcome based on how many aircraft were lost: a perfect run earns a promotion, one loss earns a reprimand, losing half or more of the flights results in suspension, and losing every flight gets the controller fired.

An airborne flight that strays to the edge of the grid (coordinate 0 or 30 on either axis) is considered lost, is flagged for attention, and is automatically redirected back toward the airport.

Movement distance each tick scales directly with a flight's current speed, so a flight at 1000 kt covers ground faster than one at 200 kt. Speed commands are limited to 120-600 kt. An airborne flight that reaches zero airspeed outside of a controlled landing stalls and crashes.


## Project structure

```text
src/
  cli/
    color.ts
    commandParser.ts
    renderer.ts
  simulation/
    constants.ts
    flightFactory.ts
    lifecycle.ts
    movement.ts
    pendingCommands.ts
    safety.ts
    Simulation.ts
  index.ts
  types.ts

tests/
  simulation.test.ts
```

## Notes

- Climb and descent rates are modeled at 250 ft/s.
- Speed commands complete at a rate of 5 knots per second when decreasing and 2.5 knots per second when increasing.
- Heading commands complete at a turn rate of 3 degrees per second.
- Departures and takeoffs are intentionally out of scope for this version.

## Future Enhancements

- Generate replacement flights over time after the initial three-flight session.
- Add explicit aircraft movement commands and more detailed position tracking.
- Expand collision, proximity, and crash scenarios with clearer recovery actions.
- Add runway and gate occupancy management as traffic volume grows.
- Improve ATC phraseology and add more command validation guidance.
