import type { DeckSnapshot, Finding } from "@magistrat/shared-types";
import { describe, expect, it } from "vitest";
import { groupBySlideId, orderedSlideIdsForFindings } from "./FindingsPanel.js";

function f(id: string, slideId: string): Finding {
  return {
    id,
    ruleId: "BP-TYPO-001",
    source: "playbook",
    slideId,
    observed: {},
    expected: {},
    evidence: [],
    confidence: 1,
    risk: "safe",
    severity: "warn",
    coverage: "ANALYZED"
  };
}

describe("orderedSlideIdsForFindings", () => {
  it("orders by deck slide index then orphan slide ids", () => {
    const grouped = groupBySlideId([
      f("a", "s3"),
      f("b", "s1"),
      f("c", "orphan"),
      f("d", "s2")
    ]);
    const deck: DeckSnapshot = {
      deckId: "d1",
      generatedAtIso: "",
      slides: [
        { slideId: "s1", index: 1, title: "A", shapes: [] },
        { slideId: "s2", index: 2, title: "B", shapes: [] },
        { slideId: "s3", index: 3, title: "C", shapes: [] }
      ]
    };
    expect(orderedSlideIdsForFindings(grouped, deck)).toEqual(["s1", "s2", "s3", "orphan"]);
  });
});
