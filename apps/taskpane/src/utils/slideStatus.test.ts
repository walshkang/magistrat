import type { DeckSnapshot, Finding } from "@magistrat/shared-types";
import { describe, expect, it } from "vitest";
import { computeSlideStatuses } from "./slideStatus.js";

function baseFinding(overrides: Partial<Finding> & Pick<Finding, "id" | "slideId">): Finding {
  return {
    ruleId: "BP-TYPO-001",
    source: "playbook",
    observed: {},
    expected: {},
    evidence: [],
    confidence: 1,
    risk: "safe",
    severity: "warn",
    coverage: "ANALYZED",
    ...overrides
  };
}

function deck(...slides: { slideId: string; index: number; title?: string }[]): DeckSnapshot {
  return {
    deckId: "d1",
    generatedAtIso: "",
    slides: slides.map((s) => ({
      slideId: s.slideId,
      index: s.index,
      title: s.title ?? "",
      slideWidth: 720,
      slideHeight: 405,
      shapes: []
    }))
  };
}

describe("computeSlideStatuses", () => {
  it("returns empty array when deck has no slides", () => {
    expect(computeSlideStatuses([], deck())).toEqual([]);
  });

  it("all slides pass with findingCount 0 when there are no findings", () => {
    const d = deck(
      { slideId: "a", index: 1 },
      { slideId: "b", index: 2 }
    );
    expect(computeSlideStatuses([], d)).toEqual([
      { slideId: "a", slideIndex: 1, title: "", status: "pass", findingCount: 0 },
      { slideId: "b", slideIndex: 2, title: "", status: "pass", findingCount: 0 }
    ]);
  });

  it("marks slide as error when any actionable finding has severity error", () => {
    const d = deck({ slideId: "s1", index: 1 }, { slideId: "s2", index: 2 });
    const findings: Finding[] = [
      baseFinding({ id: "1", slideId: "s1", severity: "error", coverage: "ANALYZED" }),
      baseFinding({ id: "2", slideId: "s2", severity: "warn", coverage: "ANALYZED" })
    ];
    const result = computeSlideStatuses(findings, d);
    expect(result[0]?.status).toBe("error");
    expect(result[0]?.findingCount).toBe(1);
    expect(result[1]?.status).toBe("warn");
  });

  it("marks slide as warn when only actionable warnings (no errors)", () => {
    const d = deck({ slideId: "s1", index: 1 });
    const findings: Finding[] = [
      baseFinding({ id: "1", slideId: "s1", severity: "warn", coverage: "ANALYZED" })
    ];
    const result = computeSlideStatuses(findings, d);
    expect(result[0]?.status).toBe("warn");
    expect(result[0]?.findingCount).toBe(1);
  });

  it("marks slide as not-analyzed when findings exist only as NOT_ANALYZED", () => {
    const d = deck({ slideId: "s1", index: 1 });
    const findings: Finding[] = [
      baseFinding({
        id: "1",
        slideId: "s1",
        coverage: "NOT_ANALYZED",
        notAnalyzedReason: "UNSUPPORTED_OBJECT_TYPE",
        severity: "info"
      })
    ];
    const result = computeSlideStatuses(findings, d);
    expect(result[0]?.status).toBe("not-analyzed");
    expect(result[0]?.findingCount).toBe(0);
  });

  it("mixed deck: pass, warn, error across slides", () => {
    const d = deck(
      { slideId: "p", index: 1 },
      { slideId: "w", index: 2 },
      { slideId: "e", index: 3 }
    );
    const findings: Finding[] = [
      baseFinding({ id: "1", slideId: "w", severity: "warn", coverage: "ANALYZED" }),
      baseFinding({ id: "2", slideId: "e", severity: "error", coverage: "ANALYZED" })
    ];
    const result = computeSlideStatuses(findings, d);
    expect(result.map((r) => r.status)).toEqual(["pass", "warn", "error"]);
    expect(result[0]?.findingCount).toBe(0);
    expect(result[1]?.findingCount).toBe(1);
    expect(result[2]?.findingCount).toBe(1);
  });

  it("info-only actionable findings yield pass with non-zero findingCount", () => {
    const d = deck({ slideId: "s1", index: 1 });
    const findings: Finding[] = [
      baseFinding({ id: "1", slideId: "s1", severity: "info", coverage: "ANALYZED" }),
      baseFinding({ id: "2", slideId: "s1", severity: "info", coverage: "ANALYZED" })
    ];
    const result = computeSlideStatuses(findings, d);
    expect(result[0]?.status).toBe("pass");
    expect(result[0]?.findingCount).toBe(2);
  });

  it("slide with both NOT_ANALYZED and ANALYZED findings uses ANALYZED severity", () => {
    const d = deck({ slideId: "s1", index: 1 });
    const findings: Finding[] = [
      baseFinding({
        id: "1",
        slideId: "s1",
        coverage: "NOT_ANALYZED",
        notAnalyzedReason: "UNSUPPORTED_OBJECT_TYPE",
        severity: "info"
      }),
      baseFinding({ id: "2", slideId: "s1", severity: "warn", coverage: "ANALYZED" })
    ];
    const result = computeSlideStatuses(findings, d);
    expect(result[0]?.status).toBe("warn");
    expect(result[0]?.findingCount).toBe(1);
  });

  it("error beats warn on same slide", () => {
    const d = deck({ slideId: "s1", index: 1 });
    const findings: Finding[] = [
      baseFinding({ id: "1", slideId: "s1", severity: "warn", coverage: "ANALYZED" }),
      baseFinding({ id: "2", slideId: "s1", severity: "error", coverage: "ANALYZED" })
    ];
    const result = computeSlideStatuses(findings, d);
    expect(result[0]?.status).toBe("error");
    expect(result[0]?.findingCount).toBe(2);
  });
});
