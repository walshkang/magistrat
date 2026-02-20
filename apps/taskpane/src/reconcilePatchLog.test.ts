import { describe, expect, it } from "vitest";
import type { DeckSnapshot, PatchRecord, ReconcileSignature } from "@magistrat/shared-types";
import { reconcilePatchLogByRecordIdentity } from "./reconcilePatchLog.js";

describe("reconcilePatchLogByRecordIdentity", () => {
  it("keeps duplicate patch ids independent during reconcile", () => {
    const before = signature("Calibri");
    const after = signature("Aptos");

    const records: PatchRecord[] = [
      record({
        id: "patch-dup",
        findingId: "finding-applied",
        objectId: "shape-applied",
        before,
        after
      }),
      record({
        id: "patch-dup",
        findingId: "finding-reverted",
        objectId: "shape-reverted",
        before,
        after
      })
    ];

    const deck = createDeck([
      { objectId: "shape-applied", fontFamily: "Aptos" },
      { objectId: "shape-reverted", fontFamily: "Calibri" }
    ]);

    const reconciled = reconcilePatchLogByRecordIdentity(records, deck);
    expect(reconciled.map((entry) => entry.reconcileState)).toEqual(["applied", "reverted_externally"]);
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
    reconcileState: "applied",
    appliedAtIso: "2026-02-19T12:00:00.000Z"
  };
}
