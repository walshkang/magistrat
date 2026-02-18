import { describe, expect, it } from "vitest";
import type { ExemplarSelection, Finding, StyleMap } from "@magistrat/shared-types";
import { buildStyleSignature } from "../src/public-api.js";

describe("buildStyleSignature", () => {
  it("is stable when only timestamps change", () => {
    const styleMap: StyleMap = {
      TITLE: {
        fontFamily: "Aptos Display",
        fontSizePt: 30,
        bold: true,
        italic: false,
        fontColor: "#112233"
      }
    };

    const findings: Finding[] = [
      finding("BP-TYPO-001"),
      finding("BP-COLOR-001")
    ];

    const firstExemplar: ExemplarSelection = {
      slideId: "slide-1",
      mode: "token_normalized",
      normalizationAppliedToSlide: false,
      selectedAtIso: "2026-02-18T00:00:00.000Z"
    };

    const secondExemplar: ExemplarSelection = {
      ...firstExemplar,
      selectedAtIso: "2026-02-18T01:00:00.000Z"
    };

    const first = buildStyleSignature(firstExemplar, styleMap, findings);
    const second = buildStyleSignature(secondExemplar, styleMap, findings);

    expect(first.styleSignatureHash).toBe(second.styleSignatureHash);
    expect(first.basisSummary.ruleIds).toEqual(["BP-COLOR-001", "BP-TYPO-001"]);
  });

  it("changes hash when style basis changes", () => {
    const baseline = buildStyleSignature(
      {
        slideId: "slide-1",
        mode: "original",
        normalizationAppliedToSlide: false,
        selectedAtIso: "2026-02-18T00:00:00.000Z"
      },
      {
        TITLE: {
          fontFamily: "Aptos Display",
          fontSizePt: 30,
          bold: true,
          italic: false,
          fontColor: "#112233"
        }
      },
      [finding("BP-TYPO-001")]
    );

    const changed = buildStyleSignature(
      {
        slideId: "slide-1",
        mode: "token_normalized",
        normalizationAppliedToSlide: false,
        selectedAtIso: "2026-02-18T00:00:00.000Z"
      },
      {
        TITLE: {
          fontFamily: "Aptos Display",
          fontSizePt: 32,
          bold: true,
          italic: false,
          fontColor: "#112233"
        }
      },
      [finding("BP-TYPO-001"), finding("BP-COLOR-001")]
    );

    expect(baseline.styleSignatureHash).not.toBe(changed.styleSignatureHash);
  });

  it("handles missing exemplar/styleMap deterministically", () => {
    const result = buildStyleSignature(undefined, undefined, []);
    expect(result.basisSummary.exemplarSlideId).toBe("unselected");
    expect(result.basisSummary.exemplarMode).toBe("original");
    expect(result.basisSummary.roleCount).toBe(0);
    expect(result.basisSummary.tokenCount).toBe(0);
    expect(result.basisSummary.ruleIds).toEqual([]);
  });
});

function finding(ruleId: string): Finding {
  return {
    id: `finding-${ruleId}`,
    ruleId,
    source: "exemplar",
    slideId: "slide-1",
    observed: {},
    expected: {},
    evidence: [
      {
        type: "EXEMPLAR_EVIDENCE",
        summary: "signature test"
      }
    ],
    confidence: 1,
    risk: "manual",
    severity: "info",
    coverage: "ANALYZED"
  };
}
