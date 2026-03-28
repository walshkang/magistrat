import { describe, expect, it } from "vitest";
import { migrateState, MigrationError, CURRENT_SCHEMA_VERSION } from "../src/state-migration.js";

function validV1State() {
  return {
    schemaVersion: 1,
    lastUpdatedIso: "2026-01-01T00:00:00Z",
    findings: [],
    patchLog: [],
    ignoredFindings: [],
  };
}

describe("state-migration", () => {
  it("passes through a valid V1 state unchanged", () => {
    const state = validV1State();
    const result = migrateState(state);
    expect(result.schemaVersion).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it("CURRENT_SCHEMA_VERSION is 1", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });

  it("throws MigrationError for null input", () => {
    expect(() => migrateState(null)).toThrow(MigrationError);
  });

  it("throws MigrationError for non-object input", () => {
    expect(() => migrateState("bad")).toThrow(MigrationError);
  });

  it("throws MigrationError for future schema version", () => {
    expect(() => migrateState({ schemaVersion: 99 })).toThrow(
      "newer than supported"
    );
  });

  it("throws MigrationError for version 0 with no migration registered", () => {
    expect(() => migrateState({ schemaVersion: 0 })).toThrow(
      "No migration from version 0"
    );
  });
});
