import { describe, expect, it } from "vitest";
import { computeAlignmentScore } from "../src/alignment-score.js";
import type { CoverageSnapshot, Finding } from "@magistrat/shared-types";

function baseCoverage(overrides: Partial<CoverageSnapshot>): CoverageSnapshot {
  return {
    analyzedSlides: 1,
    totalSlides: 1,
    analyzedObjects: 8,
    notAnalyzedObjects: 0,
    totalObjects: 8,
    topUnhandledObjectTypes: [],
    continuityStatus: "NOT_RUN",
    continuityCoverage: 0,
    ...overrides
  };
}

function baseFinding(overrides: Partial<Finding>): Finding {
  return {
    id: "f-1",
    ruleId: "BP-TYPO-001",
    source: "exemplar",
    slideId: "s1",
    objectId: "o1",
    role: "TITLE",
    observed: {},
    expected: {},
    evidence: [{ type: "EXEMPLAR_EVIDENCE", summary: "x" }],
    confidence: 1,
    risk: "safe",
    severity: "warn",
    coverage: "ANALYZED",
    ...overrides
  };
}

describe("computeAlignmentScore", () => {
  it("returns 100 when there are zero findings with nonzero analyzed objects", () => {
    const r = computeAlignmentScore([], baseCoverage({ analyzedObjects: 5 }));
    expect(r).toEqual({
      score: 100,
      analyzedObjects: 5,
      passingObjects: 5,
      failingObjects: 0
    });
  });

  it("returns 0 when every analyzed object has at least one ANALYZED finding", () => {
    const findings: Finding[] = [];
    for (let i = 0; i < 4; i += 1) {
      findings.push(
        baseFinding({
          id: `f-${i}`,
          slideId: "s1",
          objectId: `o${i}`
        })
      );
    }
    const r = computeAlignmentScore(findings, baseCoverage({ analyzedObjects: 4 }));
    expect(r.score).toBe(0);
    expect(r.failingObjects).toBe(4);
    expect(r.passingObjects).toBe(0);
  });

  it("scores 75 when 8 analyzed and 2 unique failing objects", () => {
    const findings: Finding[] = [
      baseFinding({ id: "a", slideId: "s1", objectId: "o0" }),
      baseFinding({ id: "b", slideId: "s1", objectId: "o1" })
    ];
    const r = computeAlignmentScore(findings, baseCoverage({ analyzedObjects: 8 }));
    expect(r.score).toBe(75);
    expect(r.failingObjects).toBe(2);
    expect(r.passingObjects).toBe(6);
  });

  it("excludes NOT_ANALYZED findings from failing object count", () => {
    const findings: Finding[] = [
      baseFinding({
        id: "na",
        coverage: "NOT_ANALYZED",
        notAnalyzedReason: "UNSUPPORTED_OBJECT_TYPE"
      }),
      baseFinding({ id: "ok", slideId: "s1", objectId: "o1" })
    ];
    const r = computeAlignmentScore(findings, baseCoverage({ analyzedObjects: 4 }));
    expect(r.failingObjects).toBe(1);
    expect(r.passingObjects).toBe(3);
    expect(r.score).toBe(75);
  });

  it("counts multiple ANALYZED findings on the same object as one failing object", () => {
    const findings: Finding[] = [
      baseFinding({ id: "a", ruleId: "BP-TYPO-001", slideId: "s1", objectId: "o0" }),
      baseFinding({ id: "b", ruleId: "BP-TYPO-002", slideId: "s1", objectId: "o0" })
    ];
    const r = computeAlignmentScore(findings, baseCoverage({ analyzedObjects: 8 }));
    expect(r.failingObjects).toBe(1);
    expect(r.passingObjects).toBe(7);
    expect(r.score).toBe(88);
  });

  it("returns score 100 and zeros when analyzedObjects is 0", () => {
    const r = computeAlignmentScore(
      [baseFinding({ id: "x" })],
      baseCoverage({ analyzedObjects: 0, totalObjects: 0, analyzedSlides: 0, totalSlides: 0 })
    );
    expect(r).toEqual({
      score: 100,
      analyzedObjects: 0,
      passingObjects: 0,
      failingObjects: 0
    });
  });

  it("ignores ANALYZED findings without objectId for failing count", () => {
    const withObject = baseFinding({
      id: "slide-level",
      ruleId: "BP-CONT-001",
      source: "continuity"
    });
    const { objectId, ...rest } = withObject;
    void objectId;
    const slideLevel: Finding = rest;
    const r = computeAlignmentScore([slideLevel], baseCoverage({ analyzedObjects: 3 }));
    expect(r.failingObjects).toBe(0);
    expect(r.score).toBe(100);
  });
});
