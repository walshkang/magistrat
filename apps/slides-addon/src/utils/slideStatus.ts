import type { DeckSnapshot, Finding } from "@magistrat/shared-types";

export type SlideStatus = "pass" | "warn" | "error" | "not-analyzed";

export interface SlideStatusEntry {
  slideId: string;
  slideIndex: number;
  title: string;
  status: SlideStatus;
  findingCount: number;
}

/**
 * Compute per-slide status from findings and deck.
 *
 * Rules:
 * - "error": slide has at least one finding with severity === "error"
 * - "warn": slide has at least one finding with severity === "warn" (and no errors)
 * - "not-analyzed": slide has ONLY NOT_ANALYZED findings (no actionable findings)
 * - "pass": slide has zero findings, or all actionable findings are severity "info"
 *
 * Slides with no findings at all are "pass".
 */
export function computeSlideStatuses(findings: Finding[], deck: DeckSnapshot): SlideStatusEntry[] {
  if (deck.slides.length === 0) {
    return [];
  }

  const bySlide = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = bySlide.get(f.slideId);
    if (list) {
      list.push(f);
    } else {
      bySlide.set(f.slideId, [f]);
    }
  }

  return deck.slides.map((slide) => {
    const slideFindings = bySlide.get(slide.slideId) ?? [];
    const actionable = slideFindings.filter((f) => f.coverage === "ANALYZED");
    const findingCount = actionable.length;

    let status: SlideStatus;
    if (actionable.some((f) => f.severity === "error")) {
      status = "error";
    } else if (actionable.some((f) => f.severity === "warn")) {
      status = "warn";
    } else if (slideFindings.length > 0 && actionable.length === 0) {
      status = "not-analyzed";
    } else {
      status = "pass";
    }

    return {
      slideId: slide.slideId,
      slideIndex: slide.index,
      title: slide.title,
      status,
      findingCount
    };
  });
}
