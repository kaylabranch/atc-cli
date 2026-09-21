import type { ActiveCommand, Flight } from '../types.js';

export type PendingAction = 'speed' | 'heading' | 'altitude' | 'gate' | 'runway' | 'clear-to-land' | 'abort-landing' | 'hold' | 'taxi-to-gate' | 'unload';

export type Motion = {
  startAltitude: number;
  startSpeed: number;
  targetAltitude: number;
  targetSpeed: number;
};

export type PendingCommand = ActiveCommand & {
  action: PendingAction;
  target: string | number;
  durationMs: number;
  elapsedMs: number;
  motion?: Motion;
};

export class PendingCommands {
  private commands: PendingCommand[] = [];
  private nextId = 1;

  get all(): PendingCommand[] {
    return this.commands;
  }

  getActive(): ActiveCommand[] {
    return this.commands.map(({ id, callsign, description, progress }) => ({
      id,
      callsign,
      description,
      progress: Math.round(progress),
    }));
  }

  find(predicate: (command: PendingCommand) => boolean): PendingCommand | undefined {
    return this.commands.find(predicate);
  }

  isInProgress(callsign: string, action: PendingAction): boolean {
    return this.commands.some((command) =>
      command.callsign.toLowerCase() === callsign.toLowerCase() && command.action === action
    );
  }

  remove(command: PendingCommand): void {
    this.commands = this.commands.filter((candidate) => candidate !== command);
  }

  add(flight: Flight, action: PendingAction, target: string | number, description: string, durationMs: number, motion?: Motion): void {
    this.commands.push({
      id: this.nextId,
      callsign: flight.callsign,
      description,
      progress: 0,
      action,
      target,
      durationMs,
      elapsedMs: 0,
      motion,
    });
    this.nextId += 1;
  }

  advance(elapsedMilliseconds: number, findFlight: (callsign: string) => Flight | undefined): PendingCommand[] {
    for (const command of this.commands) {
      command.elapsedMs += elapsedMilliseconds;
      command.progress = Math.min(100, (command.elapsedMs / command.durationMs) * 100);
      if (command.motion) {
        const flight = findFlight(command.callsign);
        if (flight) {
          const ratio = command.progress / 100;
          flight.altitude = Math.round(command.motion.startAltitude + (command.motion.targetAltitude - command.motion.startAltitude) * ratio);
          flight.speed = Math.round(command.motion.startSpeed + (command.motion.targetSpeed - command.motion.startSpeed) * ratio);
        }
      }
    }

    const completed = this.commands.filter((command) => command.progress >= 100);
    this.commands = this.commands.filter((command) => command.progress < 100);
    return completed;
  }
}
