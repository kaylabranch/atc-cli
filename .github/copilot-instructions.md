# Project details
**Adherence to these rules is mandatory, ALWAYS check this file and follow these rules.**

- This is a CLI simulation project that simulates Air Traffic Control (ATC) operations.
- The project is written in TypeScript and Node.js, and it follows a modular architecture to ensure maintainability and scalability.
- The project is designed to be extensible, allowing for the addition of new features and functionalities in the future.
- The project includes a comprehensive set of unit tests to ensure the correctness and reliability of the codebase.
- The user should be able to start the simulation, issue commands to the flights, and view their status through the command line interface (CLI).

## Requirements
- Flights are generated randomly with a unique callsign, and an origin that may or may not be unique.
- The simulation starts with exactly 3 flights and does not generate replacement flights yet.
- The simulation should handle multiple flights simultaneously, with each flight having its own state and behavior.
- There is one airport, the user is the ATC controller giving instructions to the Flight objects.
- The airport always has 2 runways (`77L`, `77R`) and 3 gates (`A1`, `A2`, `A3`); runway and gate counts are not configurable.
- The simulation uses one standard speed model and a fixed 1000 ms display refresh interval for now; refresh timing is not configurable.
- There is a command line interface (CLI) that allows the user to interact with the simulation, including issuing commands to the flights and viewing their status.
- The simulation should provide feedback to the user on the status of the flights, including their current state, position, and any instructions that have been issued.
- If flights collide, are too close, or crash, the simulation should provide appropriate feedback to the user and handle the situation gracefully.
- User commands should allow speed, heading, altitude, gate assignment, clearing to land, holding in a pattern, and runway assignment to be changed for each flight.
- Controller commands are represented as pending operations with progress bars in a separate `IN PROGRESS` list. Do not put progress bars on individual flights.
- A command changes a flight only when its pending operation completes. Ticks must not move aircraft autonomously.
- Speed changes use a rate of 5 knots per second when decreasing and 2.5 knots per second when increasing; this is a completion rate, not an input-size validation limit.
- Heading changes use a turn rate of 3 degrees per second; this is a completion rate, not an input-size validation limit.
- Command progress must use measured elapsed time between ticks, not assumed callback timing.
- Displayed numeric values, including altitude, speed, heading, coordinates, and percentages, should be rounded to whole numbers.
- Users should be able to get a help list of available commands and their usage.
- Users can see status on one or all flights.
- Users can pause and resume the simulation at any time.
- Users can exit the simulation at any time, and the simulation should handle this gracefully, ensuring that all resources are cleaned up properly.
- Phraseology of commands should be realistic and follow standard ATC communication protocols.
- Commands should be case-insensitive, and the simulation should handle invalid commands gracefully, providing appropriate feedback to the user.
- There should be an indicator of the number of active flights in the simulation at any given time, and any flights needing attention or that have crashed should be clearly indicated to the user, as well as the number of flights completed.
- `clear-to-land` starts a 15-second landing operation. The flight enters `landing` immediately, and altitude and speed decrease toward zero during the operation before it becomes `landed`.
- A flight must have a completed runway assignment before `clear-to-land` is accepted.
- A runway may be assigned to only one flight at a time. It is released when that flight begins taxiing to a gate and may then be reused.
- `abort-landing` cancels an active landing and starts a climb/acceleration operation back toward the flight's pre-landing altitude and speed.
- If two airborne flights come within 1 grid unit of each other, both are marked crashed; a crashed flight stops moving and counts toward the end-of-game outcome.
- An airborne flight that reaches the edge of the grid (coordinate 0 or 30 on either axis) is flagged as lost and automatically redirected toward the airport.
- Aircraft movement distance per tick scales with current speed; a faster flight covers more grid distance than a slower one over the same elapsed time.
- An airborne flight (outside a controlled landing) that reaches zero airspeed stalls and crashes.
- Speed commands are limited to a range (120-600 kt); commands outside that range are rejected.
- When the game ends, the controller receives a career outcome based on the crashed-flight ratio: no crashes is a promotion, some but under half is a reprimand, half or more is a suspension, and losing every flight is termination.
- A landed flight assigned a gate enters `taxiing` for 10 seconds, then becomes `gated` and unloads passengers for 10 seconds before being removed from the simulation.
- The game ends when all 3 starting flights are completed or crashed. A flight is completed only after it is removed from the board. New-flight generation is out of scope for now.
- Departures and takeoffs are out of scope.
- A textual representation of the airport layout should be displayed in the CLI, showing the runways, gates, and the positions of the flights in real-time.
- Aircraft do not move, land, gate, crash, or change flight values without an explicit controller command or a defined post-landing lifecycle action.
- The supported package startup command is `npm run clock-in`; `npm run dev` remains available for development.
- Descent and climb rate should be 250 ft/s.
- A runway assignment rejection must tell the controller exactly which conditions are unmet (heading, speed trend, altitude trend), including current values.
- A README file should be included with instructions on how to set up and run the simulation, as well as any dependencies or prerequisites that are required.
- The README should also include a high-level list of technologies used in the project, for example TypeScript and Node.js, as well as any libraries or frameworks that are utilized.

# General coding guidelines

## Principles
- Simplicity: Write code that is easy to read, understand, and maintain. Avoid unnecessary complexity and strive for clarity in your code.
- Modularity: Organize your code into small, reusable modules that encapsulate specific functionality.
- Single Responsibility: Each module, class, or function should have a single responsibility or purpose. Avoid mixing unrelated functionality in the same code unit.
- Consistency: Follow consistent coding conventions and best practices throughout the codebase. This includes naming conventions, formatting, and code structure.
- Readability: Prioritize code readability over cleverness. Write code that is easy to follow and understand, even for someone who is not familiar with the codebase.
- Modern Practices: Use modern language features and best practices to write clean, efficient, and maintainable code. Avoid outdated or deprecated patterns and libraries.

## Language and framework
- This project will be written in TypeScript and Node.js. Use the latest stable versions of these technologies.
- Follow the coding conventions and best practices of the programming language and framework being used.
- Use consistent naming conventions for variables, functions, classes, and other identifiers.

## Documentation
- The README and .github/copilot-instructions.md files should be updated as features are added or modified, providing clear instructions on how to use the simulation and any new functionalities.

## Naming conventions
- Use descriptive and meaningful names for variables, functions, classes, and other identifiers.
- Avoid using abbreviations or single-letter names unless they are widely accepted and understood in the context of the codebase.
- Use camelCase for variable and function names, PascalCase for class names, and UPPER_CASE for constants.

## Code reuse and utilities
- Prefer using existing functions if they exist, rather than writing new ones.
- Avoid duplicating code. If you find yourself writing the same code in multiple places, consider refactoring it into a utility function or module.
- When creating utility functions, ensure they are well-documented and tested.
- Use descriptive names for utility functions that clearly indicate their purpose and behavior.
- Pay attention to other files in the provided context to avoid duplicating existing functionality. If a similar function already exists, consider using it instead of creating a new one. Can modify if modifications would not change existing behavior.

## Testing
- Write unit tests for all new features and bug fixes.
- Ensure that tests cover edge cases and potential failure scenarios.
- Use a consistent testing framework and follow its best practices.
- When writing tests, aim for clarity and maintainability. Tests should be easy to read and understand, even for someone unfamiliar with the codebase.
- When modifying existing code, update or add tests as necessary to ensure that the changes do not introduce regressions.