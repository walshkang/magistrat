import { describe, expect, it, vi, afterEach } from "vitest";
import { emitEvent, setTelemetrySink, resetTelemetrySink } from "../src/telemetry.js";

afterEach(() => {
  resetTelemetrySink();
});

describe("telemetry", () => {
  it("emits to custom sink", () => {
    const events: unknown[] = [];
    setTelemetrySink((e) => events.push(e));

    emitEvent({ type: "scan_complete", slideCount: 5 });

    expect(events).toHaveLength(1);
    const event = events[0] as Record<string, unknown>;
    expect(event.type).toBe("scan_complete");
    expect(event.slideCount).toBe(5);
    expect(typeof event.timestamp).toBe("string");
  });

  it("auto-fills timestamp if omitted", () => {
    const events: unknown[] = [];
    setTelemetrySink((e) => events.push(e));

    emitEvent({ type: "test" });

    const event = events[0] as Record<string, unknown>;
    expect(event.timestamp).toBeDefined();
  });

  it("preserves explicit timestamp", () => {
    const events: unknown[] = [];
    setTelemetrySink((e) => events.push(e));

    emitEvent({ type: "test", timestamp: "2026-01-01T00:00:00Z" });

    const event = events[0] as Record<string, unknown>;
    expect(event.timestamp).toBe("2026-01-01T00:00:00Z");
  });

  it("defaults to console sink", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    emitEvent({ type: "hello" });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toBe("[magistrat:telemetry]");
    spy.mockRestore();
  });

  it("resetTelemetrySink restores console sink", () => {
    const events: unknown[] = [];
    setTelemetrySink((e) => events.push(e));
    resetTelemetrySink();

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    emitEvent({ type: "after_reset" });

    expect(events).toHaveLength(0);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
