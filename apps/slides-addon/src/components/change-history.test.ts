import type { PatchRecord } from "@magistrat/shared-types";
import { describe, expect, it } from "vitest";
import { inferChangeLabel, translatePatchRecord } from "./ChangeHistory.js";

function baseRecord(overrides: Partial<PatchRecord> = {}): PatchRecord {
  return {
    id: "p1",
    findingId: "f1",
    targetFingerprint: {
      slideId: "s1",
      objectId: "o1",
      preconditionHash: "h"
    },
    before: {
      fontFamily: "Arial",
      fontSizePt: 12,
      fontColor: "#111111",
      bold: false,
      italic: false,
      bulletIndent: null,
      bulletHanging: null
    },
    after: {
      fontFamily: "Arial",
      fontSizePt: 12,
      fontColor: "#111111",
      bold: false,
      italic: false,
      bulletIndent: null,
      bulletHanging: null
    },
    reconcileState: "applied",
    appliedAtIso: "2026-03-28T12:00:00.000Z",
    ...overrides
  };
}

describe("inferChangeLabel", () => {
  it("returns generic when multiple categories change", () => {
    const b = baseRecord();
    const r: PatchRecord = {
      ...b,
      before: { ...b.before, fontFamily: "Arial", fontColor: "#111111" },
      after: { ...b.after, fontFamily: "Inter", fontColor: "#222222" }
    };
    expect(inferChangeLabel(r)).toBe("Applied style fix");
  });

  it("describes font family change", () => {
    const b = baseRecord();
    const r: PatchRecord = {
      ...b,
      before: { ...b.before, fontFamily: "Arial" },
      after: { ...b.after, fontFamily: "Inter" }
    };
    expect(inferChangeLabel(r)).toBe("Fixed font family: Arial → Inter");
  });

  it("describes reconcile annotation in translatePatchRecord", () => {
    const b = baseRecord();
    const r: PatchRecord = {
      ...b,
      before: { ...b.before, fontFamily: "Arial" },
      after: { ...b.after, fontFamily: "Inter" },
      reconcileState: "reverted_externally"
    };
    expect(translatePatchRecord(r, null, []).label).toContain("reverted externally");
  });
});
