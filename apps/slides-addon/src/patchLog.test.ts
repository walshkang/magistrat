import { describe, expect, it } from "vitest";
import { stableTargetFingerprint } from "@magistrat/google-adapter";
import type { DeckSnapshot, PatchOp, PatchRecord, ReconcileSignature } from "@magistrat/shared-types";
import {
  buildSafeRestoreOps,
  countReconcileStates,
  countStateTransitions,
  getRestoreUiDisabledReason,
  groupPatchRecordsByAppliedAtIso,
  hasSafeRestoreDiff,
  isEmptySignature,
  reconcilePatchLogByRecordIdentity,
  sortPatchRecordsNewestFirst
} from "./patchLog.js";

describe("patchLog helpers", () => {
  it("reconciles duplicate patch ids by record identity", () => {
    const before = signature("Calibri");
    const after = signature("Aptos");

    const records: PatchRecord[] = [
      record({
        id: "patch-dup",
        findingId: "finding-applied",
        objectId: "shape-applied",
        before,
        after,
        appliedAtIso: "2026-02-19T12:00:00.000Z"
      }),
      record({
        id: "patch-dup",
        findingId: "finding-reverted",
        objectId: "shape-reverted",
        before,
        after,
        appliedAtIso: "2026-02-19T12:00:00.000Z"
      })
    ];

    const deck = createDeck([
      { objectId: "shape-applied", fontFamily: "Aptos" },
      { objectId: "shape-reverted", fontFamily: "Calibri" }
    ]);

    const reconciled = reconcilePatchLogByRecordIdentity(records, deck);
    expect(reconciled.map((entry) => entry.reconcileState)).toEqual(["applied", "reverted_externally"]);
  });

  it("sorts and groups records deterministically", () => {
    const records: PatchRecord[] = [
      record({
        id: "patch-c",
        findingId: "finding-c",
        objectId: "shape-c",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T10:00:00.000Z"
      }),
      record({
        id: "patch-a",
        findingId: "finding-a",
        objectId: "shape-a",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T12:00:00.000Z"
      }),
      record({
        id: "patch-b",
        findingId: "finding-b",
        objectId: "shape-b",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T12:00:00.000Z"
      }),
      record({
        id: "patch-d",
        findingId: "finding-d",
        objectId: "shape-d",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T09:00:00.000Z"
      })
    ];

    const sorted = sortPatchRecordsNewestFirst(records);
    expect(sorted.map((entry) => entry.id)).toEqual(["patch-a", "patch-b", "patch-c", "patch-d"]);

    const groups = groupPatchRecordsByAppliedAtIso(records);
    expect(groups).toHaveLength(3);
    expect(groups[0]?.appliedAtIso).toBe("2026-02-19T12:00:00.000Z");
    expect(groups[0]?.records.map((entry) => entry.id)).toEqual(["patch-a", "patch-b"]);
    expect(groups[1]?.appliedAtIso).toBe("2026-02-19T10:00:00.000Z");
    expect(groups[2]?.appliedAtIso).toBe("2026-02-19T09:00:00.000Z");
  });

  it("counts reconcile states with missing_target distinct", () => {
    const records: PatchRecord[] = [
      record({
        id: "patch-1",
        findingId: "finding-1",
        objectId: "shape-1",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T10:00:00.000Z",
        reconcileState: "applied"
      }),
      record({
        id: "patch-2",
        findingId: "finding-2",
        objectId: "shape-2",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T10:00:00.000Z",
        reconcileState: "reverted_externally"
      }),
      record({
        id: "patch-3",
        findingId: "finding-3",
        objectId: "shape-3",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T10:00:00.000Z",
        reconcileState: "drifted"
      }),
      record({
        id: "patch-4",
        findingId: "finding-4",
        objectId: "shape-4",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T10:00:00.000Z",
        reconcileState: "missing_target"
      }),
      record({
        id: "patch-5",
        findingId: "finding-5",
        objectId: "shape-5",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T10:00:00.000Z",
        reconcileState: "missing_target"
      })
    ];

    expect(countReconcileStates(records)).toEqual({
      applied: 1,
      reverted_externally: 1,
      drifted: 1,
      missing_target: 2
    });
  });

  it("counts state transitions across reconciles", () => {
    const first = record({
      id: "patch-1",
      findingId: "finding-1",
      objectId: "shape-1",
      before: signature("Aptos"),
      after: signature("Aptos"),
      appliedAtIso: "2026-02-19T10:00:00.000Z",
      reconcileState: "applied"
    });
    const second = record({
      id: "patch-2",
      findingId: "finding-2",
      objectId: "shape-2",
      before: signature("Aptos"),
      after: signature("Aptos"),
      appliedAtIso: "2026-02-19T10:00:00.000Z",
      reconcileState: "reverted_externally"
    });
    const third = record({
      id: "patch-3",
      findingId: "finding-3",
      objectId: "shape-3",
      before: signature("Aptos"),
      after: signature("Aptos"),
      appliedAtIso: "2026-02-19T10:00:00.000Z",
      reconcileState: "missing_target"
    });
    const previous: PatchRecord[] = [first, second, third];

    const next: PatchRecord[] = [
      {
        ...first,
        reconcileState: "drifted"
      },
      second,
      third,
      record({
        id: "patch-4",
        findingId: "finding-4",
        objectId: "shape-4",
        before: signature("Aptos"),
        after: signature("Aptos"),
        appliedAtIso: "2026-02-19T10:00:00.000Z",
        reconcileState: "applied"
      })
    ];

    expect(countStateTransitions(previous, next)).toBe(2);
  });

  it("treats only all-null signatures as empty", () => {
    expect(
      isEmptySignature({
        fontFamily: null,
        fontSizePt: null,
        fontColor: null,
        bold: null,
        italic: null,
        bulletIndent: null,
        bulletHanging: null
      })
    ).toBe(true);

    expect(
      isEmptySignature({
        fontFamily: "Aptos",
        fontSizePt: null,
        fontColor: null,
        bold: null,
        italic: null,
        bulletIndent: null,
        bulletHanging: null
      })
    ).toBe(false);
  });

  it("detects safe restore diffs", () => {
    const before = signature("Aptos");
    const after = signature("Calibri");
    const changed = record({
      id: "patch-diff",
      findingId: "finding-diff",
      objectId: "shape-diff",
      before,
      after,
      appliedAtIso: "2026-02-19T10:00:00.000Z"
    });
    const unchanged = record({
      id: "patch-same",
      findingId: "finding-same",
      objectId: "shape-same",
      before: signature("Aptos"),
      after: signature("Aptos"),
      appliedAtIso: "2026-02-19T10:00:00.000Z"
    });

    expect(hasSafeRestoreDiff(changed)).toBe(true);
    expect(hasSafeRestoreDiff(unchanged)).toBe(false);
  });

  it("builds only safe restore ops and computes fresh fingerprint from snapshot state", () => {
    const before: ReconcileSignature = {
      fontFamily: "Aptos",
      fontSizePt: 12,
      fontColor: "#AABBCC",
      bold: true,
      italic: true,
      bulletIndent: 24,
      bulletHanging: 12
    };
    const after: ReconcileSignature = {
      fontFamily: "Calibri",
      fontSizePt: 12,
      fontColor: "#223344",
      bold: false,
      italic: false,
      bulletIndent: 18,
      bulletHanging: 9
    };
    const patch = record({
      id: "patch-restore",
      findingId: "finding-restore",
      objectId: "shape-restore",
      before,
      after,
      appliedAtIso: "2026-02-19T10:00:00.000Z"
    });
    const deck = createDeck([{ objectId: "shape-restore", fontFamily: "Deck-Family" }]);
    const result = buildSafeRestoreOps(patch, deck, "2026-02-20T01:02:03.456Z");
    const allowedOps = new Set<PatchOp["op"]>([
      "SET_FONT_FAMILY",
      "SET_FONT_COLOR",
      "SET_FONT_STYLE",
      "SET_BULLET_INDENT"
    ]);

    expect(result.reason).toBeUndefined();
    expect(result.restoreOps).toHaveLength(4);
    expect(result.restoreOps.every((op) => allowedOps.has(op.op))).toBe(true);

    const expectedTarget = stableTargetFingerprint("slide-1", "shape-restore", {
      fontFamily: "Deck-Family",
      fontColor: "#111111",
      bold: false,
      italic: false,
      bulletIndent: 18,
      bulletHanging: 9
    });

    for (const op of result.restoreOps) {
      expect(op.target.slideId).toBe("slide-1");
      expect(op.target.objectId).toBe("shape-restore");
      expect(op.target.preconditionHash).toBe(expectedTarget.preconditionHash);
    }
  });

  it("returns explicit reasons for delete-like, no-diff, and missing-target restore attempts", () => {
    const deleteLike = record({
      id: "patch-delete",
      findingId: "finding-delete",
      objectId: "shape-delete",
      before: signature("Aptos"),
      after: {
        fontFamily: null,
        fontSizePt: null,
        fontColor: null,
        bold: null,
        italic: null,
        bulletIndent: null,
        bulletHanging: null
      },
      appliedAtIso: "2026-02-19T10:00:00.000Z"
    });
    const noDiff = record({
      id: "patch-nodiff",
      findingId: "finding-nodiff",
      objectId: "shape-nodiff",
      before: signature("Aptos"),
      after: signature("Aptos"),
      appliedAtIso: "2026-02-19T10:00:00.000Z"
    });
    const missingTarget = record({
      id: "patch-missing",
      findingId: "finding-missing",
      objectId: "shape-missing",
      before: signature("Aptos"),
      after: signature("Calibri"),
      appliedAtIso: "2026-02-19T10:00:00.000Z"
    });
    const deck = createDeck([{ objectId: "shape-other", fontFamily: "Deck" }]);

    expect(buildSafeRestoreOps(deleteLike, deck, "2026-02-20T01:02:03.456Z").reason).toContain("delete-like");
    expect(buildSafeRestoreOps(noDiff, deck, "2026-02-20T01:02:03.456Z").reason).toContain("no safe field diff");
    expect(buildSafeRestoreOps(missingTarget, deck, "2026-02-20T01:02:03.456Z").reason).toContain("missing");
  });

  it("returns truthful restore disable reasons", () => {
    const base = record({
      id: "patch-base",
      findingId: "finding-base",
      objectId: "shape-base",
      before: signature("Aptos"),
      after: signature("Calibri"),
      appliedAtIso: "2026-02-19T10:00:00.000Z"
    });

    expect(getRestoreUiDisabledReason(base, false, "apply unsupported")).toBe("apply unsupported");
    expect(
      getRestoreUiDisabledReason(
        {
          ...base,
          reconcileState: "drifted"
        },
        true
      )
    ).toContain("applied");
    expect(
      getRestoreUiDisabledReason(
        {
          ...base,
          after: {
            fontFamily: null,
            fontSizePt: null,
            fontColor: null,
            bold: null,
            italic: null,
            bulletIndent: null,
            bulletHanging: null
          }
        },
        true
      )
    ).toContain("delete-like");
    expect(
      getRestoreUiDisabledReason(
        {
          ...base,
          before: signature("Aptos"),
          after: signature("Aptos")
        },
        true
      )
    ).toContain("no safe fields");
    expect(getRestoreUiDisabledReason(base, true)).toBeUndefined();
  });
});

function createDeck(shapes: Array<{ objectId: string; fontFamily: string }>): DeckSnapshot {
  return {
    deckId: "deck-1",
    generatedAtIso: "2026-02-19T12:00:00.000Z",
    slides: [
      {
        slideId: "slide-1",
        index: 1,
        title: "Slide",
        shapes: shapes.map((shape, index) => ({
          objectId: shape.objectId,
          name: shape.objectId,
          shapeType: "TEXT",
          visible: true,
          grouped: false,
          zIndex: index,
          textRuns: [
            {
              text: "Text",
              fontFamily: shape.fontFamily,
              fontSizePt: 12,
              bold: false,
              italic: false,
              fontColor: "#111111",
              fontAlpha: 1
            }
          ],
          paragraphs: [
            {
              level: 0,
              bulletIndent: 18,
              bulletHanging: 9,
              text: "Text"
            }
          ],
          geometry: {
            left: 0,
            top: index * 10,
            width: 100,
            height: 20,
            rotation: 0
          },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: {
            typography: true,
            bullets: true
          }
        }))
      }
    ]
  };
}

function signature(fontFamily: string): ReconcileSignature {
  return {
    fontFamily,
    fontSizePt: 12,
    fontColor: "#111111",
    bold: false,
    italic: false,
    bulletIndent: 18,
    bulletHanging: 9
  };
}

function record(input: {
  id: string;
  findingId: string;
  objectId: string;
  before: ReconcileSignature;
  after: ReconcileSignature;
  appliedAtIso: string;
  reconcileState?: PatchRecord["reconcileState"];
}): PatchRecord {
  return {
    id: input.id,
    findingId: input.findingId,
    targetFingerprint: {
      slideId: "slide-1",
      objectId: input.objectId,
      preconditionHash: `hash-${input.objectId}`
    },
    before: input.before,
    after: input.after,
    reconcileState: input.reconcileState ?? "applied",
    appliedAtIso: input.appliedAtIso
  };
}
