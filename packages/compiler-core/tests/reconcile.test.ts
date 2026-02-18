import { describe, expect, it } from "vitest";
import type { PatchRecord, ReconcileSignature } from "@magistrat/shared-types";
import { reconcilePatches } from "../src/public-api.js";
import { buildReconcileSignatureFromShape, normalizeReconcileSignature } from "../src/reconcile.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";

describe("reconcilePatches", () => {
  it("classifies applied/reverted/drifted/missing_target deterministically", () => {
    const beforeSignature = signature("Calibri");
    const afterSignature = signature("Aptos");

    const deck = createDeck({
      slides: [
        createSlide({
          slideId: "slide-1",
          shapes: [
            createShape({
              objectId: "shape-applied",
              textRuns: [
                {
                  text: "x",
                  fontFamily: "Aptos",
                  fontSizePt: 12,
                  bold: false,
                  italic: false,
                  fontColor: "#111111",
                  fontAlpha: 1
                }
              ]
            }),
            createShape({
              objectId: "shape-reverted",
              textRuns: [
                {
                  text: "x",
                  fontFamily: "Calibri",
                  fontSizePt: 12,
                  bold: false,
                  italic: false,
                  fontColor: "#111111",
                  fontAlpha: 1
                }
              ]
            }),
            createShape({
              objectId: "shape-drifted",
              textRuns: [
                {
                  text: "x",
                  fontFamily: "Courier New",
                  fontSizePt: 12,
                  bold: false,
                  italic: false,
                  fontColor: "#111111",
                  fontAlpha: 1
                }
              ]
            })
          ]
        })
      ]
    });

    const patches: PatchRecord[] = [
      record("patch-applied", "shape-applied", beforeSignature, afterSignature),
      record("patch-reverted", "shape-reverted", beforeSignature, afterSignature),
      record("patch-drifted", "shape-drifted", beforeSignature, afterSignature),
      record("patch-missing", "shape-missing", beforeSignature, afterSignature)
    ];

    const result = reconcilePatches(patches, deck);
    const stateById = new Map(result.map((entry) => [entry.patch.id, entry.nextState]));

    expect(stateById.get("patch-applied")).toBe("applied");
    expect(stateById.get("patch-reverted")).toBe("reverted_externally");
    expect(stateById.get("patch-drifted")).toBe("drifted");
    expect(stateById.get("patch-missing")).toBe("missing_target");
  });

  it("normalizes reconcile signatures for missing/partial values", () => {
    const emptyFromShape = buildReconcileSignatureFromShape(undefined);
    expect(emptyFromShape).toEqual({
      fontFamily: null,
      fontSizePt: null,
      fontColor: null,
      bold: null,
      italic: null,
      bulletIndent: null,
      bulletHanging: null
    });

    const normalized = normalizeReconcileSignature({
      fontFamily: "Aptos",
      fontSizePt: 12,
      bulletIndent: 18
    });

    expect(normalized).toEqual({
      fontFamily: "Aptos",
      fontSizePt: 12,
      fontColor: null,
      bold: null,
      italic: null,
      bulletIndent: 18,
      bulletHanging: null
    });
  });
});

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

function record(
  id: string,
  objectId: string,
  before: ReconcileSignature,
  after: ReconcileSignature
): PatchRecord {
  return {
    id,
    findingId: `finding-${id}`,
    targetFingerprint: {
      slideId: "slide-1",
      objectId,
      preconditionHash: "h123"
    },
    before,
    after,
    reconcileState: "applied",
    appliedAtIso: "2026-02-18T00:00:00.000Z"
  };
}
