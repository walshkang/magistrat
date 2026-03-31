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

  findings.push(...collectTitleCapitalizationFindings(deck));
  findings.push(...collectPageNumberFindings(deck));
  findings.push(...collectDateNumberFormatFindings(deck));

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

type TitleCapStyle = "TITLE_CASE" | "UPPER_CASE" | "SENTENCE_CASE" | "MIXED";

const TITLE_CASE_EXCEPTIONS = new Set([
  "and",
  "or",
  "of",
  "in",
  "the",
  "a",
  "an",
  "for",
  "to",
  "but",
  "nor"
]);

const MONTH_LONG_NAMES =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const MONTH_SHORT_NAMES = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

function stripWordPunctuation(word: string): string {
  return word.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
}

function isSentenceCaseStyle(text: string): boolean {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) {
    return false;
  }
  const firstCore = stripWordPunctuation(words[0] ?? "");
  const firstChar = firstCore.charAt(0);
  if (!firstCore || firstChar !== firstChar.toUpperCase()) {
    return false;
  }
  for (let i = 1; i < words.length; i++) {
    const core = stripWordPunctuation(words[i] ?? "");
    if (!core) {
      continue;
    }
    if (core !== core.toLowerCase()) {
      return false;
    }
  }
  return true;
}

function isTitleCaseStyle(text: string): boolean {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) {
    return false;
  }
  for (const w of words) {
    const core = stripWordPunctuation(w);
    if (!core) {
      continue;
    }
    const lower = core.toLowerCase();
    if (TITLE_CASE_EXCEPTIONS.has(lower)) {
      continue;
    }
    const first = core.charAt(0);
    if (core.length >= 4) {
      if (first !== first.toUpperCase()) {
        return false;
      }
      if (core.slice(1) !== core.slice(1).toLowerCase()) {
        return false;
      }
    } else if (!TITLE_CASE_EXCEPTIONS.has(lower)) {
      if (first !== first.toUpperCase()) {
        return false;
      }
      if (core.slice(1) !== core.slice(1).toLowerCase()) {
        return false;
      }
    }
  }
  return true;
}

function classifyCapitalizationStyle(raw: string): TitleCapStyle {
  const text = raw.trim();
  if (text.length === 0) {
    return "MIXED";
  }
  const lettersOnly = text.replace(/[^a-zA-Z]/g, "");
  if (lettersOnly.length === 0) {
    return "MIXED";
  }
  if (lettersOnly === lettersOnly.toUpperCase()) {
    return "UPPER_CASE";
  }
  if (isTitleCaseStyle(text)) {
    return "TITLE_CASE";
  }
  if (isSentenceCaseStyle(text)) {
    return "SENTENCE_CASE";
  }
  return "MIXED";
}

function getPrimaryTitleShapeText(slide: DeckSnapshot["slides"][number]): string | null {
  const titles = [...slide.shapes]
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
  for (const shape of titles) {
    const t = extractShapeText(shape).trim();
    if (t.length > 0) {
      return t;
    }
  }
  return null;
}

function collectTitleCapitalizationFindings(deck: DeckSnapshot): Finding[] {
  const ordered = [...deck.slides].sort((a, b) => a.index - b.index || a.slideId.localeCompare(b.slideId));
  const rows: { slideId: string; titleText: string; style: TitleCapStyle }[] = [];
  for (const slide of ordered) {
    const titleText = getPrimaryTitleShapeText(slide);
    if (!titleText) {
      continue;
    }
    rows.push({
      slideId: slide.slideId,
      titleText,
      style: classifyCapitalizationStyle(titleText)
    });
  }
  if (rows.length < 3) {
    return [];
  }
  const counts = new Map<TitleCapStyle, number>();
  for (const row of rows) {
    counts.set(row.style, (counts.get(row.style) ?? 0) + 1);
  }
  const dominantEntry = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  })[0];
  const dominantStyle = dominantEntry?.[0];
  if (!dominantStyle || dominantStyle === "MIXED") {
    return [];
  }
  const findings: Finding[] = [];
  for (const row of rows) {
    if (row.style === dominantStyle) {
      continue;
    }
    findings.push({
      id: `finding-${stableHash([row.slideId, "BP-TYPO-008", row.style, dominantStyle])}`,
      ruleId: "BP-TYPO-008",
      source: "continuity",
      slideId: row.slideId,
      observed: { style: row.style, titleText: row.titleText },
      expected: { dominantStyle },
      evidence: [
        {
          type: "REFERENTIAL_EVIDENCE",
          summary: "Capitalization style differs from the dominant convention in this deck."
        },
        {
          type: "TYPOGRAPHIC_EVIDENCE",
          summary: "Inconsistent title capitalization signals a multi-author Frankenstein deck."
        }
      ],
      confidence: 1,
      risk: "manual",
      severity: "info",
      coverage: "ANALYZED"
    });
  }
  return findings;
}

function firstIntegerInText(text: string): number | null {
  const m = text.match(/\b(\d+)\b/);
  if (!m?.[1]) {
    return null;
  }
  return parseInt(m[1], 10);
}

function extractSlidePageNumber(slide: DeckSnapshot["slides"][number]): number | null {
  const footers = [...slide.shapes]
    .filter((s) => s.inferredRole === "FOOTER")
    .sort((a, b) => a.zIndex - b.zIndex || a.objectId.localeCompare(b.objectId));
  for (const shape of footers) {
    const n = firstIntegerInText(extractShapeText(shape));
    if (n !== null) {
      return n;
    }
  }
  const shapes = [...slide.shapes].sort((a, b) => a.zIndex - b.zIndex || a.objectId.localeCompare(b.objectId));
  for (const shape of shapes) {
    for (const run of shape.textRuns) {
      const t = run.text.trim();
      if (/^\d+$/.test(t)) {
        return parseInt(t, 10);
      }
    }
  }
  return null;
}

function collectPageNumberFindings(deck: DeckSnapshot): Finding[] {
  const ordered = [...deck.slides].sort((a, b) => a.index - b.index || a.slideId.localeCompare(b.slideId));
  const numbered: { slideIndex: number; slideId: string; pageNumber: number }[] = [];
  for (const slide of ordered) {
    const n = extractSlidePageNumber(slide);
    if (n !== null) {
      numbered.push({ slideIndex: slide.index, slideId: slide.slideId, pageNumber: n });
    }
  }
  const findings: Finding[] = [];
  const seenPageToSlide = new Map<number, string>();
  for (const entry of numbered) {
    const prior = seenPageToSlide.get(entry.pageNumber);
    if (prior !== undefined) {
      findings.push({
        id: `finding-${stableHash([entry.slideId, "BP-CONT-004", "duplicate", entry.pageNumber])}`,
        ruleId: "BP-CONT-004",
        source: "continuity",
        slideId: entry.slideId,
        observed: {
          pageNumber: entry.pageNumber,
          slideIndex: entry.slideIndex,
          conflict: "duplicate_page_number",
          priorSlideId: prior
        },
        expected: { conflict: "unique_page_numbers" },
        evidence: [
          {
            type: "REFERENTIAL_EVIDENCE",
            summary: "Page number sequence gap or duplicate detected."
          },
          {
            type: "HYGIENE_EVIDENCE",
            summary: "Executives navigate printed decks by page number — gaps and duplicates break navigation."
          }
        ],
        confidence: 1,
        risk: "manual",
        severity: "warn",
        coverage: "ANALYZED"
      });
    } else {
      seenPageToSlide.set(entry.pageNumber, entry.slideId);
    }
  }
  for (let i = 0; i < numbered.length - 1; i++) {
    const a = numbered[i]!;
    const b = numbered[i + 1]!;
    if (b.pageNumber - a.pageNumber <= 1) {
      continue;
    }
    let hasUnnumberedBetween = false;
    for (const slide of ordered) {
      if (slide.index > a.slideIndex && slide.index < b.slideIndex && extractSlidePageNumber(slide) === null) {
        hasUnnumberedBetween = true;
        break;
      }
    }
    if (!hasUnnumberedBetween) {
      findings.push({
        id: `finding-${stableHash([b.slideId, "BP-CONT-004", "gap", a.pageNumber, b.pageNumber])}`,
        ruleId: "BP-CONT-004",
        source: "continuity",
        slideId: b.slideId,
        observed: {
          pageNumber: b.pageNumber,
          slideIndex: b.slideIndex,
          priorPageNumber: a.pageNumber,
          priorSlideIndex: a.slideIndex,
          conflict: "sequence_gap"
        },
        expected: {
          expectedSequence: "consecutive_integers_when_no_unnumbered_slides_between_numbered_slides",
          expectedNextPageNumber: a.pageNumber + 1
        },
        evidence: [
          {
            type: "REFERENTIAL_EVIDENCE",
            summary: "Page number sequence gap or duplicate detected."
          },
          {
            type: "HYGIENE_EVIDENCE",
            summary: "Executives navigate printed decks by page number — gaps and duplicates break navigation."
          }
        ],
        confidence: 1,
        risk: "manual",
        severity: "warn",
        coverage: "ANALYZED"
      });
    }
  }
  return findings;
}

interface FormatOccurrence {
  category: "date" | "number";
  format: string;
  value: string;
  slideId: string;
  objectId: string;
}

function pushIsoDateMatches(text: string, slideId: string, objectId: string, out: FormatOccurrence[]): void {
  const re = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ category: "date", format: "ISO", value: m[0], slideId, objectId });
  }
}

function pushLongUsDateMatches(text: string, slideId: string, objectId: string, out: FormatOccurrence[]): void {
  const re = new RegExp(
    `\\b(${MONTH_LONG_NAMES})\\s+(\\d{1,2}),\\s*(\\d{4})\\b`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ category: "date", format: "LONG_US", value: m[0], slideId, objectId });
  }
}

function pushDmyDashDateMatches(text: string, slideId: string, objectId: string, out: FormatOccurrence[]): void {
  const re = new RegExp(
    `\\b(\\d{1,2})-(${MONTH_SHORT_NAMES})-(\\d{4})\\b`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ category: "date", format: "DMY_DASH_ALPHA", value: m[0], slideId, objectId });
  }
}

function pushSlashDateMatches(text: string, slideId: string, objectId: string, out: FormatOccurrence[]): void {
  const re = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const a = +m[1]!;
    const b = +m[2]!;
    let fmt: "MDY_SLASH" | "DMY_SLASH";
    if (a > 12) {
      fmt = "DMY_SLASH";
    } else if (b > 12) {
      fmt = "MDY_SLASH";
    } else if (a <= 12 && b <= 12 && a !== b) {
      continue;
    } else {
      fmt = "MDY_SLASH";
    }
    out.push({ category: "date", format: fmt, value: m[0], slideId, objectId });
  }
}

function stripDateLikeSpans(text: string): string {
  let t = text;
  t = t.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (m) => " ".repeat(m.length));
  t = t.replace(
    new RegExp(`\\b(?:${MONTH_LONG_NAMES})\\s+\\d{1,2},\\s*\\d{4}\\b`, "gi"),
    (m) => " ".repeat(m.length)
  );
  t = t.replace(
    new RegExp(`\\b\\d{1,2}-(?:${MONTH_SHORT_NAMES})-\\d{4}\\b`, "gi"),
    (m) => " ".repeat(m.length)
  );
  t = t.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, (m) => " ".repeat(m.length));
  return t;
}

function pushNumberFormatMatches(text: string, slideId: string, objectId: string, out: FormatOccurrence[]): void {
  const commaRe = /\b\d{1,3}(?:,\d{3})+\b/g;
  let m: RegExpExecArray | null;
  while ((m = commaRe.exec(text)) !== null) {
    const raw = m[0].replace(/,/g, "");
    const v = parseInt(raw, 10);
    if (v > 999) {
      out.push({ category: "number", format: "COMMA_SEPARATOR", value: m[0], slideId, objectId });
    }
  }
  const dotRe = /\b\d{1,3}(?:\.\d{3})+\b/g;
  while ((m = dotRe.exec(text)) !== null) {
    const raw = m[0].replace(/\./g, "");
    const v = parseInt(raw, 10);
    if (v > 999) {
      out.push({ category: "number", format: "DOT_SEPARATOR", value: m[0], slideId, objectId });
    }
  }
  const plainRe = /\b\d{4,}\b/g;
  while ((m = plainRe.exec(text)) !== null) {
    const v = parseInt(m[0], 10);
    if (v > 999) {
      out.push({ category: "number", format: "NO_SEPARATOR", value: m[0], slideId, objectId });
    }
  }
}

function collectDateNumberFormatFindings(deck: DeckSnapshot): Finding[] {
  const occurrences: FormatOccurrence[] = [];
  const ordered = [...deck.slides].sort((a, b) => a.index - b.index || a.slideId.localeCompare(b.slideId));
  for (const slide of ordered) {
    for (const shape of slide.shapes) {
      for (const para of shape.paragraphs) {
        const text = para.text;
        pushIsoDateMatches(text, slide.slideId, shape.objectId, occurrences);
        pushLongUsDateMatches(text, slide.slideId, shape.objectId, occurrences);
        pushDmyDashDateMatches(text, slide.slideId, shape.objectId, occurrences);
        pushSlashDateMatches(text, slide.slideId, shape.objectId, occurrences);
        const stripped = stripDateLikeSpans(text);
        pushNumberFormatMatches(stripped, slide.slideId, shape.objectId, occurrences);
      }
    }
  }
  const dates = occurrences.filter((o) => o.category === "date");
  const numbers = occurrences.filter((o) => o.category === "number");
  return [...emitDominantMinorityFindings(dates, "date"), ...emitDominantMinorityFindings(numbers, "number")];
}

function emitDominantMinorityFindings(
  occs: FormatOccurrence[],
  category: "date" | "number"
): Finding[] {
  if (occs.length < 3) {
    return [];
  }
  const counts = new Map<string, number>();
  for (const o of occs) {
    counts.set(o.format, (counts.get(o.format) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  })[0]?.[0];
  if (!dominant) {
    return [];
  }
  const findings: Finding[] = [];
  for (const o of occs) {
    if (o.format === dominant) {
      continue;
    }
    findings.push({
      id: `finding-${stableHash([o.slideId, o.objectId, "BP-CONT-005", category, o.format, o.value])}`,
      ruleId: "BP-CONT-005",
      source: "continuity",
      slideId: o.slideId,
      objectId: o.objectId,
      observed: { format: o.format, value: o.value, category },
      expected: { dominantFormat: dominant },
      evidence: [
        {
          type: "REFERENTIAL_EVIDENCE",
          summary: "Date/number format differs from the dominant convention in this deck."
        },
        {
          type: "HYGIENE_EVIDENCE",
          summary: "Mixed formats signal multi-author assembly and erode precision credibility."
        }
      ],
      confidence: 1,
      risk: "manual",
      severity: "warn",
      coverage: "ANALYZED"
    });
  }
  return findings;
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
