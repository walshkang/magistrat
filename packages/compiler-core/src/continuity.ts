import type { DeckSnapshot, Finding, ShapeSnapshot } from "@magistrat/shared-types";
import { stableHash } from "./hash.js";

const AGENDA_KEYWORDS = ["agenda", "contents", "table of contents", "toc"] as const;
const AGENDA_KEYWORD_SET = new Set(AGENDA_KEYWORDS.map((keyword) => normalizeForMatch(keyword)));

interface EffectiveTitle {
  slideId: string;
  slideIndex: number;
  slide: DeckSnapshot["slides"][number];
  title: string;
  normalized: string;
  source: "none" | "slide.title" | "title-shape";
}

interface AgendaItem {
  text: string;
  normalized: string;
}

export interface RunContinuityChecksResult {
  findings: Finding[];
  continuityStatus: "RAN";
  continuityCoverage: number;
}

export function runContinuityChecks(deck: DeckSnapshot): RunContinuityChecksResult {
  const findings: Finding[] = [];
  const effectiveTitles = buildEffectiveTitles(deck);

  for (const titleInfo of effectiveTitles) {
    if (titleInfo.normalized.length > 0) {
      continue;
    }

    findings.push(createMissingTitleFinding(titleInfo.slideId, titleInfo.source));
  }

  const agendaSlide = findFirstAgendaSlide(effectiveTitles);
  if (agendaSlide) {
    const agendaItems = extractAgendaItems(agendaSlide.slide);
    const candidateTitles = new Set(
      effectiveTitles
        .filter((titleInfo) => titleInfo.slideId !== agendaSlide.slideId)
        .map((titleInfo) => titleInfo.normalized)
        .filter((normalized) => normalized.length > 0 && !AGENDA_KEYWORD_SET.has(normalized))
    );

    const unmatchedAgendaItems: string[] = [];
    const unmatchedAgendaItemsNormalized: string[] = [];
    let matchedCount = 0;

    for (const item of agendaItems) {
      if (candidateTitles.has(item.normalized)) {
        matchedCount += 1;
      } else {
        unmatchedAgendaItems.push(item.text);
        unmatchedAgendaItemsNormalized.push(item.normalized);
      }
    }

    if (unmatchedAgendaItems.length > 0) {
      findings.push(
        createAgendaMismatchFinding({
          agendaSlideId: agendaSlide.slideId,
          unmatchedAgendaItems,
          unmatchedAgendaItemsNormalized,
          matchedCount,
          totalAgendaItems: agendaItems.length,
          comparedTitleCount: candidateTitles.size
        })
      );
    }
  }

  const sectionHeaders: { slideId: string; archetype: string }[] = [];
  const orderedSlides = [...deck.slides].sort((a, b) => a.index - b.index || a.slideId.localeCompare(b.slideId));
  for (const slide of orderedSlides) {
    if (isSectionHeaderCandidate(slide)) {
      sectionHeaders.push({ slideId: slide.slideId, archetype: deriveSectionHeaderArchetype(slide) });
    }
  }
  if (sectionHeaders.length >= 2) {
    const expectedArchetype = sectionHeaders[0]!.archetype;
    for (let i = 1; i < sectionHeaders.length; i++) {
      const entry = sectionHeaders[i]!;
      if (entry.archetype !== expectedArchetype) {
        findings.push(
          createSectionHeaderArchetypeFinding(entry.slideId, entry.archetype, expectedArchetype)
        );
      }
    }
  }

  return {
    findings,
    continuityStatus: "RAN",
    continuityCoverage: 1
  };
}

function buildEffectiveTitles(deck: DeckSnapshot): EffectiveTitle[] {
  return [...deck.slides]
    .sort((a, b) => a.index - b.index || a.slideId.localeCompare(b.slideId))
    .map((slide) => {
      const resolved = resolveEffectiveTitle(slide);
      return {
        slideId: slide.slideId,
        slideIndex: slide.index,
        slide,
        title: resolved.title,
        normalized: normalizeForMatch(resolved.title),
        source: resolved.source
      };
    });
}

function resolveEffectiveTitle(slide: DeckSnapshot["slides"][number]): {
  title: string;
  source: "none" | "slide.title" | "title-shape";
} {
  const slideTitle = slide.title.trim();
  if (slideTitle.length > 0) {
    return { title: slideTitle, source: "slide.title" };
  }

  const titleShapes = [...slide.shapes]
    .filter((shape) => shape.inferredRole === "TITLE")
    .sort((a, b) => {
      const scoreDelta = (b.inferredRoleScore ?? 0) - (a.inferredRoleScore ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const topDelta = a.geometry.top - b.geometry.top;
      if (topDelta !== 0) {
        return topDelta;
      }

      return a.objectId.localeCompare(b.objectId);
    });

  for (const shape of titleShapes) {
    const text = extractShapeText(shape).trim();
    if (text.length > 0) {
      return { title: text, source: "title-shape" };
    }
  }

  return { title: "", source: "none" };
}

function extractShapeText(shape: ShapeSnapshot): string {
  const paragraphText = shape.paragraphs
    .map((paragraph) => paragraph.text.trim())
    .filter((text) => text.length > 0)
    .join(" ")
    .trim();
  if (paragraphText.length > 0) {
    return paragraphText;
  }

  return shape.textRuns
    .map((run) => run.text.trim())
    .filter((text) => text.length > 0)
    .join(" ")
    .trim();
}

function findFirstAgendaSlide(effectiveTitles: EffectiveTitle[]): EffectiveTitle | undefined {
  return effectiveTitles.find((titleInfo) => AGENDA_KEYWORD_SET.has(titleInfo.normalized));
}

function extractAgendaItems(slide: DeckSnapshot["slides"][number]): AgendaItem[] {
  const items: AgendaItem[] = [];
  const seen = new Set<string>();

  const orderedShapes = [...slide.shapes].sort((a, b) => a.zIndex - b.zIndex || a.objectId.localeCompare(b.objectId));
  for (const shape of orderedShapes) {
    for (const paragraph of shape.paragraphs) {
      if (paragraph.level > 1) {
        continue;
      }

      const text = paragraph.text.trim();
      if (text.length === 0) {
        continue;
      }

      const normalized = normalizeForMatch(text);
      if (normalized.length === 0 || AGENDA_KEYWORD_SET.has(normalized) || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      items.push({ text, normalized });
    }
  }

  return items;
}

function createMissingTitleFinding(
  slideId: string,
  source: "none" | "slide.title" | "title-shape"
): Finding {
  return {
    id: `finding-${stableHash([slideId, "BP-CONT-001"])}`,
    ruleId: "BP-CONT-001",
    source: "continuity",
    slideId,
    observed: {
      effectiveTitle: "",
      titleSource: source,
      titlelessMarkerSupported: false
    },
    expected: {
      state: "non_empty_title_or_titleless_marker"
    },
    evidence: [
      {
        type: "REFERENTIAL_EVIDENCE",
        summary: "Slide has no resolvable title text."
      },
      {
        type: "REFERENTIAL_EVIDENCE",
        summary: "Titleless marker exceptions are not yet implemented in v1.",
        detail: {
          titlelessMarkerSupported: false
        }
      }
    ],
    confidence: 1,
    risk: "manual",
    severity: "warn",
    coverage: "ANALYZED"
  };
}

interface AgendaMismatchInput {
  agendaSlideId: string;
  unmatchedAgendaItems: string[];
  unmatchedAgendaItemsNormalized: string[];
  matchedCount: number;
  totalAgendaItems: number;
  comparedTitleCount: number;
}

/**
 * Section header slide (v1): has visible TITLE text and no BODY or bullet list text.
 * Used only for BP-CONT-003 archetype comparison.
 */
function isSectionHeaderCandidate(slide: DeckSnapshot["slides"][number]): boolean {
  let hasTitleText = false;
  for (const shape of slide.shapes) {
    if (shape.inferredRole === "TITLE" && extractShapeText(shape).trim().length > 0) {
      hasTitleText = true;
      break;
    }
  }
  if (!hasTitleText) {
    return false;
  }

  for (const shape of slide.shapes) {
    const role = shape.inferredRole ?? "UNKNOWN";
    const text = extractShapeText(shape).trim();
    if (text.length === 0) {
      continue;
    }
    if (role === "BODY" || role === "BULLET_L1" || role === "BULLET_L2") {
      return false;
    }
  }
  return true;
}

function deriveSectionHeaderArchetype(slide: DeckSnapshot["slides"][number]): string {
  const rolesWithText = new Set<string>();
  for (const shape of slide.shapes) {
    const text = extractShapeText(shape).trim();
    if (text.length === 0) {
      continue;
    }
    const role = shape.inferredRole ?? "UNKNOWN";
    if (role !== "UNKNOWN") {
      rolesWithText.add(role);
    }
  }
  return [...rolesWithText].sort().join("+");
}

function createSectionHeaderArchetypeFinding(
  slideId: string,
  observedArchetype: string,
  expectedArchetype: string
): Finding {
  return {
    id: `finding-${stableHash([slideId, "BP-CONT-003", observedArchetype, expectedArchetype])}`,
    ruleId: "BP-CONT-003",
    source: "continuity",
    slideId,
    observed: { sectionHeaderArchetype: observedArchetype },
    expected: { sectionHeaderArchetype: expectedArchetype },
    evidence: [
      {
        type: "REFERENTIAL_EVIDENCE",
        summary: "Section header slide role mix differs from the first section header in deck order."
      }
    ],
    confidence: 1,
    risk: "manual",
    severity: "info",
    coverage: "ANALYZED"
  };
}

function createAgendaMismatchFinding(input: AgendaMismatchInput): Finding {
  return {
    id: `finding-${stableHash([input.agendaSlideId, "BP-CONT-002", input.unmatchedAgendaItemsNormalized])}`,
    ruleId: "BP-CONT-002",
    source: "continuity",
    slideId: input.agendaSlideId,
    observed: {
      agendaPresent: true,
      agendaSlideId: input.agendaSlideId,
      unmatchedAgendaItems: input.unmatchedAgendaItems,
      unmatchedAgendaItemsNormalized: input.unmatchedAgendaItemsNormalized,
      matchedCount: input.matchedCount,
      totalAgendaItems: input.totalAgendaItems
    },
    expected: {
      state: "all_agenda_items_map_to_slide_titles"
    },
    evidence: [
      {
        type: "REFERENTIAL_EVIDENCE",
        summary: "Agenda items were compared against normalized slide titles."
      },
      {
        type: "REFERENTIAL_EVIDENCE",
        summary: "One or more agenda items had no slide-title match.",
        detail: {
          comparedTitleCount: input.comparedTitleCount,
          unmatchedCount: input.unmatchedAgendaItems.length
        }
      }
    ],
    confidence: 1,
    risk: "manual",
    severity: "warn",
    coverage: "ANALYZED"
  };
}

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[\u2022\-*]+/g, "")
    .replace(/^\(?\d+\)?[.)\]:-]?\s*/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
