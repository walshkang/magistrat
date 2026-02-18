import type { ExemplarSelection, Finding, RatifyBasisSummary, StyleMap } from "@magistrat/shared-types";
import { stableHash } from "./hash.js";

export interface StyleSignatureResult {
  styleSignatureHash: string;
  basisSummary: RatifyBasisSummary;
}

export function buildStyleSignature(
  exemplar: ExemplarSelection | undefined,
  styleMap: StyleMap | undefined,
  findings: Finding[]
): StyleSignatureResult {
  const normalizedStyleMap = styleMap ?? {};
  const uniqueRuleIds = [...new Set(findings.map((finding) => finding.ruleId))].sort((a, b) => a.localeCompare(b));
  const basisSummary: RatifyBasisSummary = {
    exemplarSlideId: exemplar?.slideId ?? "unselected",
    exemplarMode: exemplar?.mode ?? "original",
    roleCount: Object.keys(normalizedStyleMap).length,
    tokenCount: countStyleTokens(normalizedStyleMap),
    ruleIds: uniqueRuleIds
  };

  const signatureBasis = {
    exemplarSlideId: basisSummary.exemplarSlideId,
    exemplarMode: basisSummary.exemplarMode,
    styleMapDigest: stableHash(normalizedStyleMap),
    ruleDigest: stableHash(uniqueRuleIds)
  };

  return {
    styleSignatureHash: stableHash(signatureBasis),
    basisSummary
  };
}

function countStyleTokens(styleMap: StyleMap): number {
  let tokenCount = 0;

  for (const tokens of Object.values(styleMap)) {
    if (!tokens) {
      continue;
    }

    tokenCount += Object.values(tokens).filter((value) => value !== undefined).length;
  }

  return tokenCount;
}
