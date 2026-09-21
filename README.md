# ✈️ ATC CLI Simulation

A terminal-based Air Traffic Control simulation written in TypeScript and Node.js. The user controls flights from a command-line REPL, monitors their state, assigns runways and gates, and manages traffic in a simplified airport environment.

<img width="1129" height="493" alt="ATC CLI screenshot 2" src="https://github.com/user-attachments/assets/1f44f282-7dcb-4d93-86ea-50a8357126df" />

<img width="1124" height="471" alt="ATC CLI screenshot 6" src="https://github.com/user-attachments/assets/f7154218-c917-40c2-b024-26903ae6dce2" />

## Features

- Command-line REPL for controlling 3 randomly generated flights with unique callsigns
- Speed, heading, altitude, gate, runway, clear-to-land, and abort-landing commands, each represented as a pending operation with a progress bar
- Runway assignment validation with a detailed rejection message calling out exactly which condition (heading, speed trend, altitude trend) is unmet
- Full landing lifecycle: runway assignment, clearance to land, taxi to gate, and passenger unload before a flight leaves the board
- Conflict alerts for flights that stray too close together, and mid-air collisions for flights that get even closer
- Boundary redirection for flights that stray to the edge of the simulation grid
- Stall detection for airborne flights that lose all airspeed outside of a controlled landing
- A career outcome (promotion, reprimand, suspension, or termination) once the game ends, based on flight outcome
- Status board, airport layout, grid position map, and altitude cross-section, all refreshed in place
- Logging generated after each session

## Tech stack

- TypeScript
- Node.js
- Vitest
- tsx
- picocolors

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
   UAL123 speed 240
   UAL123 heading 180
   UAL123 altitude 12000
   UAL123 gate A1
   UAL123 runway 77L
   UAL123 clear-to-land
   pause
   resume
   exit
   ```

4. Run `help` at any time to see the full in-app command reference. It's organized into:

   - **General** - `help`, `close-help`, `status`, `pause`, `resume`, `exit`.
  - **Flight commands** - usage for `speed`, `heading`, `altitude`, `runway`, `clear-to-land`, `abort-landing`, and `gate`, each annotated with its valid range or rate. Speed accepts nonnegative values and changes at 5 kt/s; zero speed stalls, and speeds above 600 kt cause overspeed crashes.
   - **Workflow** - the required order of operations for landing a flight: `runway` -> `clear-to-land` -> wait for `landed` -> `gate`.
   - **Tips** - how to read the `IN PROGRESS` list, what a red-highlighted flight means, and the `Tab` autocomplete shortcut.
   - **Examples** - ready-to-run sample commands.

   Flight commands always use callsign-first order, just like real ATC phraseology: `<callsign> <command> <value>` (for example, `UAL123 speed 240`). Run `close-help` to dismiss the help text once you're done reading it.

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
  ```

To choose a flight command without typing its name, enter a callsign followed by a space, such as `UAL123 `. A compact popup appears below the prompt. Type a command prefix to filter it, such as `UAL123 h` or `UAL123 hea` for `heading`. Press `Enter` or `Tab` to accept the highlighted match; the command is inserted into the prompt with a trailing space, ready for its value.

## Details

The airport always uses 2 runways (`77L`, `77R`) and 3 gates (`A1`, `A2`, `A3`). The simulation starts with 3 flights and uses a fixed 1000 ms display update interval. The status table includes runway and gate assignments. Airborne flights move continuously as time passes using their current speed and heading; headings use aviation convention (`0°` north, `90°` east). Landed, taxiing, and gated flights remain stationary.

Landing takes 2 seconds per grid unit from the airport. During landing, altitude and speed decrease toward zero. Use `abort-landing` while a flight is landing to cancel the descent and climb back toward its pre-landing altitude and speed.

Assign a runway before clearing a flight to land, and bring the flight within 10 grid units of the airport. For example, use `UAL123 runway 77L`, wait for the assignment to complete, then use `UAL123 clear-to-land`.

A flight must be pointed toward the airport and must have completed both a decreasing-speed command and a decreasing-altitude command before a runway assignment is accepted. If a runway assignment is rejected, the response spells out exactly which condition(s) are unmet, including the flight's current heading, speed, and altitude.

Only one flight may occupy a runway at a time. A runway is released when its flight begins taxiing to a gate and can then be assigned to another flight.

Command progress uses measured elapsed time between ticks. For example, changing speed by 100 knots at 5 knots per second takes 20 seconds, even if a display tick is delayed.

When running in an interactive terminal, the dashboard refreshes in place and keeps the current command line intact while controller commands are in progress. Commands are applied to a flight only when their progress reaches 100%. After landing, assign a gate; the aircraft taxis to that gate for 10 seconds, then unloads passengers for 10 seconds before leaving the simulation.

The game ends when all three starting flights are completed or crashed. A flight counts as completed only after it has been removed from the board. New-flight generation is not enabled yet.

Aircraft that come dangerously close together (within 3 grid units and 100 ft or less apart vertically) are flagged as a conflict alert. If two flights collide (within 1 grid unit and 100 ft or less apart vertically) while airborne, both are marked as crashed and are counted toward the end-of-game outcome. Flights at safe vertical separation do not conflict just because their map positions overlap. When the game ends, the dashboard shows a career outcome based on how many aircraft were lost: a perfect run earns a promotion, one loss earns a reprimand, losing half or more of the flights results in suspension, and losing every flight gets the controller fired.

Flights below 80 kt or above 550 kt need attention. Below 110 kt, an airborne flight loses altitude as its speed falls. Reaching zero altitude outside a controlled landing causes ground impact. Crashed flights are removed from the active-flight and attention counters.

An airborne flight that strays to the edge of the grid (coordinate 0 or 30 on either axis) is considered lost, is flagged for attention, and is automatically redirected back toward the airport.

Movement distance each tick scales directly with a flight's current speed, so a flight at 1000 kt covers ground faster than one at 200 kt. Speed commands accept nonnegative values. An airborne flight that reaches zero airspeed outside of a controlled landing stalls and crashes; exceeding 600 kt causes an overspeed crash.


## Project structure

```text
src/
  -- application source code for the simulation, CLI, and shared game types.
  logging/
    -- session logging for controller actions and automatic flight outcomes.
    gameLogger.ts       -- groups each flight's commands and outcomes into a timestamped log file.
  cli/
    -- command parsing, terminal styling, and user-facing dashboard rendering.
    color.ts            -- terminal color helpers and progress bar styling used in the dashboard.
    commandParser.ts    -- parses ATC commands, validates command order, and supports callsign completion.
    renderer.ts         -- builds the help screen, status board, airport layout, grid, and altitude chart.
  simulation/
    -- gameplay logic for flight motion, commands, safety checks, and simulation lifecycle events.
    constants.ts        -- shared config values such as runway/gate counts, tick timing, and safety thresholds.
    flightFactory.ts    -- creates the starting flights with randomized callsigns, origin, and initial state.
    lifecycle.ts        -- applies completed pending actions like landing, taxiing, unloading, and aborting.
    movement.ts         -- updates airborne aircraft positions based on heading, speed, and elapsed time.
    pendingCommands.ts  -- tracks in-progress commands, progress percentages, and command durations.
    safety.ts           -- collision detection, stall logic, boundary redirection, and runway validation.
    Simulation.ts       -- the core simulation engine, game state, and command handling for all aircraft.
  index.ts             -- CLI entry point, REPL loop, slash-command menu, and interactive terminal behavior.
  types.ts             -- shared TypeScript types for flights, commands, and simulation results.

tests/
  -- automated regression tests for the simulation's core behavior and edge cases.
  simulation.test.ts   -- Vitest suite covering command parsing, movement, landing, runway logic, and crash scenarios.

logs/
  -- generated session logs. Each file uses the format MMDDYYYY-HHmm.log.
```

## Notes

- Climb and descent rates are modeled at 250 ft/s.
- Speed commands complete at a rate of 5 knots per second in either direction.
- Airborne movement is displayed at 1.5 times the base speed conversion.
- Heading commands complete at a turn rate of 3 degrees per second.
- Departures and takeoffs are intentionally out of scope for this version.

When the terminal session exits, controller commands and automatic flight outcomes are saved to a timestamped file in `logs/`. Entries are grouped by flight callsign and include accepted or rejected commands, state changes, crashes, landings, and completed flights. Logs are primarily useful for debugging in this case, but of course would be mandatory in a regulated environment.

<img width="1647" height="972" alt="ATC CLI screenshot logs" src="https://github.com/user-attachments/assets/7c655ac6-0e2f-441b-9b06-622516a7f607" />

## Future Enhancements

- Generate replacement flights over time after the initial three-flight session.
- Add explicit aircraft movement commands and more detailed position tracking.
- Expand collision, proximity, and crash scenarios with clearer recovery actions.
- Add runway and gate occupancy management as traffic volume grows.
- Improve ATC phraseology and add more command validation guidance.
