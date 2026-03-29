import { describe, expect, it } from "vitest";
import { collectGroupSafetyFindings } from "../src/public-api.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";
import type { PatchOp } from "@magistrat/shared-types";

describe("collectGroupSafetyFindings — BP-SAFETY-001", () => {
  it("emits when a geometry patch targets a grouped shape", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          slideId: "s1",
          shapes: [
            createShape({
              objectId: "g1",
              grouped: true,
              inferredRole: "TITLE",
              inferredRoleScore: 0.95
            })
          ]
        })
      ]
    });
    const patches: PatchOp[] = [
      {
        id: "patch-1",
        op: "MOVE_GEOMETRY",
        target: { slideId: "s1", objectId: "g1", preconditionHash: "x" },
        fields: { left: 0, top: 0 },
        risk: "manual"
      }
    ];
    const findings = collectGroupSafetyFindings(deck, patches);
    expect(findings.some((f) => f.ruleId === "BP-SAFETY-001" && f.objectId === "g1")).toBe(true);
  });

  it("does not emit for non-geometry patches", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          slideId: "s1",
          shapes: [
            createShape({
              objectId: "g1",
              grouped: true,
              inferredRole: "TITLE",
              inferredRoleScore: 0.95
            })
          ]
        })
      ]
    });
    const patches: PatchOp[] = [
      {
        id: "patch-1",
        op: "SET_FONT_FAMILY",
        target: { slideId: "s1", objectId: "g1", preconditionHash: "x" },
        fields: { fontFamily: "Arial" },
        risk: "safe"
      }
    ];
    expect(collectGroupSafetyFindings(deck, patches)).toHaveLength(0);
  });

  it("does not emit when shape is not grouped", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          slideId: "s1",
          shapes: [
            createShape({
              objectId: "u1",
              grouped: false,
              inferredRole: "TITLE",
              inferredRoleScore: 0.95
            })
          ]
        })
      ]
    });
    const patches: PatchOp[] = [
      {
        id: "patch-1",
        op: "RESIZE_GEOMETRY",
        target: { slideId: "s1", objectId: "u1", preconditionHash: "x" },
        fields: { width: 100 },
        risk: "manual"
      }
    ];
    expect(collectGroupSafetyFindings(deck, patches)).toHaveLength(0);
  });
});
