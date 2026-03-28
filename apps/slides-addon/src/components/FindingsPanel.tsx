import type { DeckSnapshot, Finding } from "@magistrat/shared-types";
import { useMemo } from "react";
import { useDevMode } from "../context/DevModeContext.js";
import { FindingCard } from "./FindingCard.js";
import { SlideGroup } from "./SlideGroup.js";

export interface FindingsPanelProps {
  findings: Finding[];
  deck: DeckSnapshot | null;
  onApplyFinding?: (findingId: string) => void;
  onIgnoreFinding?: (findingId: string) => void;
  ignoredFindingIds?: ReadonlySet<string>;
}

export function groupBySlideId(items: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>();
  for (const f of items) {
    const list = map.get(f.slideId);
    if (list) {
      list.push(f);
    } else {
      map.set(f.slideId, [f]);
    }
  }
  return map;
}

function slideLabelFor(deck: DeckSnapshot | null, slideId: string, slideIndex: number): string {
  const slide = deck?.slides.find((s) => s.slideId === slideId);
  if (slide) {
    return `${slide.index}. ${slide.title || slide.slideId}`;
  }
  return `${slideIndex}. ${slideId}`;
}

/** Ordered slide ids that have at least one finding in `grouped`, then orphan slide ids stable-sorted. */
export function orderedSlideIdsForFindings(
  grouped: Map<string, Finding[]>,
  deck: DeckSnapshot | null
): string[] {
  const withFindings = new Set(grouped.keys());
  const fromDeck =
    deck?.slides
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((s) => s.slideId)
      .filter((id) => withFindings.has(id)) ?? [];
  const orphans = [...withFindings].filter((id) => !fromDeck.includes(id)).sort();
  return [...fromDeck, ...orphans];
}

export function FindingsPanel({
  findings,
  deck,
  onApplyFinding,
  onIgnoreFinding,
  ignoredFindingIds
}: FindingsPanelProps) {
  const { devMode } = useDevMode();

  const { slideGroups, notAnalyzedSection } = useMemo(() => {
    if (devMode) {
      const analyzed = findings.filter((f) => f.coverage !== "NOT_ANALYZED");
      const notAnalyzed = findings.filter((f) => f.coverage === "NOT_ANALYZED");
      return {
        slideGroups: groupBySlideId(analyzed),
        notAnalyzedSection: notAnalyzed
      };
    }
    return {
      slideGroups: groupBySlideId(findings),
      notAnalyzedSection: [] as Finding[]
    };
  }, [devMode, findings]);

  const orderedIds = useMemo(() => orderedSlideIdsForFindings(slideGroups, deck), [slideGroups, deck]);

  if (findings.length === 0) {
    return <p className="muted">No findings.</p>;
  }

  return (
    <div className="findings-panel">
      {orderedIds.map((slideId) => {
        const list = slideGroups.get(slideId);
        if (!list || list.length === 0) {
          return null;
        }
        const slide = deck?.slides.find((s) => s.slideId === slideId);
        const slideIndex = slide?.index ?? 0;
        return (
          <SlideGroup
            key={slideId}
            slideId={slideId}
            slideIndex={slideIndex}
            slideLabel={slideLabelFor(deck, slideId, slideIndex)}
            findings={list}
            {...(onApplyFinding ? { onApplyFinding } : {})}
            {...(onIgnoreFinding ? { onIgnoreFinding } : {})}
            {...(ignoredFindingIds ? { ignoredFindingIds } : {})}
          />
        );
      })}

      {devMode && notAnalyzedSection.length > 0 ? (
        <section className="findings-panel__not-analyzed" aria-label="Not analyzed">
          <h3 className="findings-panel__not-analyzed-title">Not analyzed</h3>
          <div className="findings-panel__not-analyzed-list">
            {notAnalyzedSection.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                isIgnored={ignoredFindingIds?.has(finding.id) ?? false}
                {...(onApplyFinding ? { onApply: () => onApplyFinding(finding.id) } : {})}
                {...(onIgnoreFinding ? { onIgnore: () => onIgnoreFinding(finding.id) } : {})}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
