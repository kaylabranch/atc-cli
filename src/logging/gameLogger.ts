import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommandResult, Flight } from '../types.js';

type FlightLog = {
    callsign: string;
    origin: string;
    entries: string[];
};

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

function timestamp(date: Date): string {
    return `${pad(date.getMonth() + 1)}${pad(date.getDate())}${date.getFullYear()}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export class GameLogger {
    private readonly flights = new Map<string, FlightLog>();
    private readonly startedAt = new Date();
    private saved = false;

    constructor(flights: Flight[]) {
        for (const flight of flights) {
            this.flights.set(flight.callsign.toLowerCase(), {
                callsign: flight.callsign,
                origin: flight.origin,
                entries: [],
            });
        }
    }

    logCommand(input: string, result: CommandResult): void {
        const parts = input.trim().split(/\s+/);
        const callsign = parts.length >= 2 ? parts[0] : undefined;
        const flightLog = callsign ? this.flights.get(callsign.toLowerCase()) : undefined;
        if (!flightLog) return;

        const outcome = result.ok ? 'accepted' : 'rejected';
        flightLog.entries.push(`[${new Date().toISOString()}] COMMAND ${outcome}: ${input.trim()} - ${result.message.replace(/\n/g, ' ')}`);
    }

    logStateChange(flight: Flight, previousState: Flight['state']): void {
        if (flight.state === previousState) return;
        const flightLog = this.flights.get(flight.callsign.toLowerCase());
        if (!flightLog) return;

        flightLog.entries.push(`[${new Date().toISOString()}] OUTCOME: ${previousState} -> ${flight.state} - ${flight.statusMessage}`);
    }

    logOutcome(flight: Flight, message: string): void {
        const flightLog = this.flights.get(flight.callsign.toLowerCase());
        if (!flightLog) return;

        flightLog.entries.push(`[${new Date().toISOString()}] OUTCOME: ${message}`);
    }

    save(): string {
        if (this.saved) return '';
        this.saved = true;

        const logsDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../logs');
        mkdirSync(logsDirectory, { recursive: true });
        const filePath = join(logsDirectory, `${timestamp(this.startedAt)}.log`);
        const lines = [
            'ATC CLI SIMULATION LOG',
            `Started: ${this.startedAt.toISOString()}`,
            `Saved: ${new Date().toISOString()}`,
            '',
        ];

        for (const flightLog of this.flights.values()) {
            lines.push(`FLIGHT ${flightLog.callsign} | Origin: ${flightLog.origin}`);
            lines.push(...(flightLog.entries.length ? flightLog.entries : ['No logged actions or outcomes.']));
            lines.push('');
        }

        writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
        return filePath;
    }
}