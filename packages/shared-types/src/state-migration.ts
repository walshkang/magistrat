/**
 * State migration — handles schema evolution for DocumentStateV1+.
 *
 * When we bump schemaVersion in a future release, add a migration function
 * to the `migrations` map below. migrateState() walks the chain from the
 * stored version to CURRENT_SCHEMA_VERSION.
 */

import type { DocumentStateV1 } from "./state.js";

export const CURRENT_SCHEMA_VERSION = 1;

/** Union of all schema shapes (currently just V1). */
export type AnyDocumentState = DocumentStateV1;

type MigrationFn = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * Map from source version → migration that produces next version.
 * Example when V2 ships:
 *   migrations.set(1, (s) => ({ ...s, schemaVersion: 2, newField: defaultValue }));
 */
const migrations: Map<number, MigrationFn> = new Map();

export function migrateState(raw: unknown): DocumentStateV1 {
  if (raw == null || typeof raw !== "object") {
    throw new MigrationError("State is null or not an object");
  }

  const obj = raw as Record<string, unknown>;
  const version = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 0;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      `State version ${version} is newer than supported (${CURRENT_SCHEMA_VERSION})`
    );
  }

  let current = { ...obj };
  let v = version;

  while (v < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations.get(v);
    if (!migrate) {
      throw new MigrationError(
        `No migration from version ${v} to ${v + 1}`
      );
    }
    current = migrate(current);
    v++;
  }

  return current as unknown as DocumentStateV1;
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}
