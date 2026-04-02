/**
 * Telemetry event emitter — console sink in v1, backend-ready contract.
 *
 * Usage:
 *   import { emitEvent, setTelemetrySink } from "./telemetry.js";
 *   emitEvent({ type: "scan_complete", durationMs: 42, slideCount: 10 });
 *
 * To swap the sink (e.g. in production with a real backend):
 *   setTelemetrySink((event) => fetch("/api/telemetry", { method: "POST", body: JSON.stringify(event) }));
 */

export interface TelemetryEvent {
  type: string;
  /** ISO timestamp — auto-filled if omitted */
  timestamp?: string;
  [key: string]: unknown;
}

export type TelemetrySink = (event: TelemetryEvent) => void;

const consoleSink: TelemetrySink = (event) => {
  console.log("[magistrat:telemetry]", JSON.stringify(event));
};

let activeSink: TelemetrySink = consoleSink;

export function setTelemetrySink(sink: TelemetrySink): void {
  activeSink = sink;
}

export function resetTelemetrySink(): void {
  activeSink = consoleSink;
}

export function emitEvent(event: TelemetryEvent): void {
  const stamped: TelemetryEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  activeSink(stamped);
}
