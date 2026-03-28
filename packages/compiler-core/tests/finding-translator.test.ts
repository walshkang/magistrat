import { describe, expect, it } from "vitest";
import { translateFinding } from "../src/finding-translator.js";
import type { Finding } from "@magistrat/shared-types";

function baseFinding(overrides: Partial<Finding>): Finding {
  return {
    id: "test-finding-1",
    ruleId: "BP-TYPO-001",
    source: "exemplar",
    slideId: "slide-1",
    objectId: "obj-1",
    role: "TITLE",
    observed: {},
    expected: {},
    evidence: [{ type: "EXEMPLAR_EVIDENCE", summary: "test" }],
    confidence: 0.95,
    risk: "safe",
    severity: "error",
    coverage: "ANALYZED",
    ...overrides
  };
}

describe("translateFinding", () => {
  describe("BP-TYPO-001 — font family mismatch", () => {
    it("produces human-readable title with observed and expected", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-TYPO-001",
          role: "TITLE",
          observed: { fontFamily: "Calibri" },
          expected: { fontFamily: "Arial" }
        })
      );
      expect(result.title).toBe("Title font should be Arial, currently Calibri");
      expect(result.actionLabel).toBe("Apply fix");
      expect(result.riskLabel).toBe("Auto-fix");
    });
  });

  describe("BP-TYPO-002 — font style mismatch", () => {
    it("describes bold/italic difference", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-TYPO-002",
          role: "BODY",
          risk: "safe",
          severity: "warn",
          observed: { bold: true, italic: false },
          expected: { bold: false, italic: false }
        })
      );
      expect(result.title).toBe("Body text should be regular, currently bold");
      expect(result.riskLabel).toBe("Auto-fix");
    });
  });

  describe("BP-TYPO-003 — font size mismatch", () => {
    it("shows pt values", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-TYPO-003",
          role: "TITLE",
          risk: "caution",
          severity: "warn",
          observed: { fontSizePt: 18 },
          expected: { fontSizePt: 24 }
        })
      );
      expect(result.title).toBe("Title font size should be 24pt, currently 18pt");
      expect(result.actionLabel).toBe("Review & apply");
      expect(result.riskLabel).toBe("Review required");
    });
  });

  describe("BP-COLOR-001 — font color mismatch", () => {
    it("shows color values", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-COLOR-001",
          role: "SUBTITLE",
          risk: "safe",
          severity: "warn",
          observed: { fontColor: "#FF0000" },
          expected: { fontColor: "#1A1A1A" }
        })
      );
      expect(result.title).toBe("Subtitle color should be #1A1A1A, currently #FF0000");
      expect(result.actionLabel).toBe("Apply fix");
    });
  });

  describe("BP-TYPO-005 — line spacing mismatch", () => {
    it("shows spacing multipliers and caution labels", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-TYPO-005",
          role: "TITLE",
          risk: "caution",
          severity: "warn",
          observed: { lineSpacing: 1.4 },
          expected: { lineSpacing: 1.2 }
        })
      );
      expect(result.title).toContain("line spacing");
      expect(result.title).toContain("1.2");
      expect(result.title).toContain("1.4");
      expect(result.actionLabel).toBe("Review & apply");
      expect(result.riskLabel).toBe("Review required");
    });
  });

  describe("BP-COLOR-002 — semi-transparent text", () => {
    it("shows opacity percentage", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-COLOR-002",
          risk: "manual",
          severity: "warn",
          observed: { fontAlpha: 0.5 },
          expected: { fontAlpha: 1.0 }
        })
      );
      expect(result.title).toBe("Semi-transparent text detected");
      expect(result.description).toContain("50%");
      expect(result.actionLabel).toBeNull();
      expect(result.riskLabel).toBe("Manual only");
    });
  });

  describe("BP-HYGIENE-002 — off-slide object", () => {
    it("shows overlap ratio in description", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-HYGIENE-002",
          risk: "manual",
          severity: "warn",
          observed: { overlapRatio: 0.09, left: -91, top: 0, width: 100, height: 100 },
          expected: { minOverlapRatio: 0.1 }
        })
      );
      expect(result.title).toBe("Object is off-slide");
      expect(result.description).toContain("9%");
      expect(result.actionLabel).toBeNull();
    });
  });

  describe("BP-BULLET-001 — bullet indent mismatch", () => {
    it("shows indent and hanging values", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-BULLET-001",
          role: "BULLET_L1",
          risk: "safe",
          severity: "warn",
          observed: { bulletIndent: 18, bulletHanging: 12 },
          expected: { bulletIndent: 24, bulletHanging: 18 }
        })
      );
      expect(result.title).toBe("Bullet (L1) bullet indent does not match exemplar");
      expect(result.description).toContain("24");
      expect(result.description).toContain("18");
    });
  });

  describe("BP-BULLET-002 — bullet glyph mismatch", () => {
    it("shows expected and observed glyphs", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-BULLET-002",
          role: "BULLET_L1",
          risk: "manual",
          severity: "info",
          observed: { bulletGlyph: "\u2013" },
          expected: { bulletGlyph: "\u2022" }
        })
      );
      expect(result.title).toContain("\u2022");
      expect(result.title).toContain("\u2013");
      expect(result.actionLabel).toBeNull();
      expect(result.riskLabel).toBe("Manual only");
    });
  });

  describe("BP-HYGIENE-001 — ghost object", () => {
    it("returns manual-only with no action", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-HYGIENE-001",
          risk: "manual",
          severity: "warn",
          observed: { visible: false, zIndex: 3 },
          expected: { noGhostObjects: true }
        })
      );
      expect(result.title).toBe("Invisible object blocking content");
      expect(result.actionLabel).toBeNull();
      expect(result.riskLabel).toBe("Manual only");
    });
  });

  describe("BP-HYGIENE-004 — placeholder text", () => {
    it("shows truncated text content", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-HYGIENE-004",
          risk: "manual",
          severity: "error",
          observed: { textContent: "Click to add subtitle" },
          expected: { pattern: "no_placeholder_text" }
        })
      );
      expect(result.title).toBe("Placeholder text detected");
      expect(result.description).toContain("Click to add subtitle");
    });
  });

  describe("BP-TYPO-004 — mixed font families", () => {
    it("lists font families", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-TYPO-004",
          risk: "manual",
          severity: "warn",
          observed: { fontFamilies: ["Arial", "Calibri"] },
          expected: { maxDistinctFamilies: 1 }
        })
      );
      expect(result.title).toBe("Mixed font families in one text box");
      expect(result.description).toContain("Arial");
      expect(result.actionLabel).toBeNull();
      expect(result.riskLabel).toBe("Manual only");
    });
  });

  describe("BP-COLOR-003 — callout fill", () => {
    it("shows expected vs observed fill", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-COLOR-003",
          role: "CALLOUT",
          risk: "manual",
          severity: "warn",
          observed: { fillColor: "#AABBCC" },
          expected: { fillColor: "#FFEEDD" }
        })
      );
      expect(result.title).toContain("#FFEEDD");
      expect(result.title).toContain("#AABBCC");
      expect(result.actionLabel).toBeNull();
    });
  });

  describe("BP-HYGIENE-003 — duplicate overlap", () => {
    it("shows overlap percentage", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-HYGIENE-003",
          risk: "manual",
          severity: "warn",
          observed: { objectId: "b", iou: 0.91, pairedObjectId: "a" },
          expected: { noDuplicateOverlaps: true }
        })
      );
      expect(result.title).toBe("Possible duplicate object");
      expect(result.description).toContain("91%");
    });
  });

  describe("BP-HYGIENE-005 — proofing language", () => {
    it("shows languages and safe apply", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-HYGIENE-005",
          risk: "safe",
          severity: "info",
          observed: { proofingLanguage: "zh-CN" },
          expected: { proofingLanguage: "en" }
        })
      );
      expect(result.title).toContain("zh-CN");
      expect(result.title).toContain("en");
      expect(result.actionLabel).toBe("Apply fix");
      expect(result.riskLabel).toBe("Auto-fix");
    });
  });

  describe("BP-CONT-001 — missing title", () => {
    it("returns manual finding", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-CONT-001",
          source: "continuity",
          risk: "manual",
          severity: "warn"
        })
      );
      expect(result.title).toBe("Slide has no title");
      expect(result.actionLabel).toBeNull();
    });
  });

  describe("BP-CONT-002 — agenda mismatch", () => {
    it("returns manual finding", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-CONT-002",
          source: "continuity",
          risk: "manual",
          severity: "warn"
        })
      );
      expect(result.title).toBe("Agenda item has no matching slide");
    });
  });

  describe("NOT_ANALYZED findings — buckets", () => {
    it("cant_inspect: title and Skipped risk label", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-COVERAGE-001",
          coverage: "NOT_ANALYZED",
          notAnalyzedReason: "UNSUPPORTED_OBJECT_TYPE"
        })
      );
      expect(result.title).toBe("Can't inspect");
      expect(result.riskLabel).toBe("Skipped");
      expect(result.description).toContain("object type");
      expect(result.actionLabel).toBeNull();
    });

    it("cant_match: title and Needs review risk label", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-COVERAGE-001",
          coverage: "NOT_ANALYZED",
          notAnalyzedReason: "LOW_ROLE_CONFIDENCE"
        })
      );
      expect(result.title).toBe("Can't match to exemplar");
      expect(result.riskLabel).toBe("Needs review");
      expect(result.description.length).toBeGreaterThan(10);
      expect(result.actionLabel).toBeNull();
    });

    it("no_rule: fixed description and Not covered risk label", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-COVERAGE-001",
          coverage: "NOT_ANALYZED",
          notAnalyzedReason: "VALIDATION_UNAVAILABLE"
        })
      );
      expect(result.title).toBe("No rule yet");
      expect(result.riskLabel).toBe("Not covered");
      expect(result.description).toBe("Magistrat doesn't have a check for this pattern yet.");
      expect(result.actionLabel).toBeNull();
    });
  });

  describe("unknown rule fallback", () => {
    it("returns a generic translation", () => {
      const result = translateFinding(
        baseFinding({
          ruleId: "BP-FUTURE-999",
          evidence: [{ type: "PLAYBOOK_EVIDENCE", summary: "Some custom check." }]
        })
      );
      expect(result.title).toContain("BP-FUTURE-999");
      expect(result.description).toBe("Some custom check.");
    });
  });
});
