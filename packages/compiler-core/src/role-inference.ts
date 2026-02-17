import type {
  DeckSnapshot,
  NotAnalyzedReasonCode,
  RoleConfidence,
  RoleV1,
  ShapeSnapshot
} from "@magistrat/shared-types";

export interface RoleInferenceIssue {
  slideId: string;
  objectId: string;
  reason: NotAnalyzedReasonCode;
}

export interface RoleInferenceResult {
  deck: DeckSnapshot;
  roleCoverage: Partial<Record<RoleV1, number>>;
  notAnalyzed: RoleInferenceIssue[];
}

export function inferRoles(deck: DeckSnapshot): RoleInferenceResult {
  const roleCoverage: Partial<Record<RoleV1, number>> = {};
  const notAnalyzed: RoleInferenceIssue[] = [];

  const mappedDeck: DeckSnapshot = {
    ...deck,
    slides: deck.slides.map((slide) => ({
      ...slide,
      shapes: slide.shapes.map((shape) => {
        const confidence = scoreRole(shape);
        const role = confidence.score >= 0.5 ? confidence.role : "UNKNOWN";

        if (!shape.supportedForAnalysis) {
          notAnalyzed.push({
            slideId: slide.slideId,
            objectId: shape.objectId,
            reason: "UNSUPPORTED_OBJECT_TYPE"
          });
          roleCoverage.UNKNOWN = (roleCoverage.UNKNOWN ?? 0) + 1;
          return {
            ...shape,
            inferredRole: "UNKNOWN",
            inferredRoleScore: 0
          };
        }

        if (role === "UNKNOWN") {
          notAnalyzed.push({
            slideId: slide.slideId,
            objectId: shape.objectId,
            reason: "LOW_ROLE_CONFIDENCE"
          });
        }

        roleCoverage[role] = (roleCoverage[role] ?? 0) + 1;
        return {
          ...shape,
          inferredRole: role,
          inferredRoleScore: confidence.score
        };
      })
    }))
  };

  return {
    deck: mappedDeck,
    roleCoverage,
    notAnalyzed
  };
}

function scoreRole(shape: ShapeSnapshot): RoleConfidence {
  const firstRun = shape.textRuns[0];
  const firstParagraph = shape.paragraphs[0];
  const text = shape.textRuns.map((run) => run.text).join(" ").trim();

  if (!text || !firstRun) {
    return { role: "UNKNOWN", score: 0.1 };
  }

  if (shape.paragraphs.some((paragraph) => paragraph.level >= 2)) {
    return { role: "BULLET_L2", score: 0.94 };
  }

  if (shape.paragraphs.some((paragraph) => paragraph.level === 1)) {
    return { role: "BULLET_L1", score: 0.93 };
  }

  if (shape.geometry.top <= 120 && firstRun.fontSizePt >= 20) {
    return { role: "TITLE", score: 0.93 };
  }

  if (shape.geometry.top <= 170 && firstRun.fontSizePt >= 16 && firstRun.fontSizePt < 24) {
    return { role: "SUBTITLE", score: 0.9 };
  }

  if (shape.geometry.top >= 470 && firstRun.fontSizePt <= 14) {
    return { role: "FOOTER", score: 0.88 };
  }

  if (text.split(/\s+/).length <= 12 && /[:.!?]$/.test(text) && firstRun.bold) {
    return { role: "CALLOUT", score: 0.76 };
  }

  if (firstParagraph && firstParagraph.level === 0 && firstRun.fontSizePt >= 12) {
    return { role: "BODY", score: 0.74 };
  }

  return { role: "UNKNOWN", score: 0.4 };
}
