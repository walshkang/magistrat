import {
  NOT_ANALYZED_BUCKET_LABELS,
  notAnalyzedBucket,
  PLAYBOOK_RULE_COUNT,
  type NotAnalyzedBucket
} from "@magistrat/compiler-core";
import type { CoverageSnapshot, DeckSnapshot, Finding } from "@magistrat/shared-types";
import { useMemo } from "react";
import { FindingCard } from "./FindingCard.js";
import { SlideGroup } from "./SlideGroup.js";

const BUCKET_ORDER: NotAnalyzedBucket[] = ["cant_match", "no_rule"];

export interface FindingsPanelProps {
  findings: Finding[];
  deck: DeckSnapshot | null;
  /** Deck-level scan stats; used for the all–NOT_ANALYZED summary line. */
  coverage?: CoverageSnapshot | null;
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

function groupNotAnalyzedByBucket(items: Finding[]): Map<NotAnalyzedBucket, Finding[]> {
  const map = new Map<NotAnalyzedBucket, Finding[]>();
  for (const f of items) {
    const bucket = notAnalyzedBucket(f.notAnalyzedReason);
    const list = map.get(bucket);
    if (list) {
      list.push(f);
    } else {
      map.set(bucket, [f]);
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
  coverage,
  onApplyFinding,
  onIgnoreFinding,
  ignoredFindingIds
}: FindingsPanelProps) {
  const { analyzed, notAnalyzed, themeInheritedCount } = useMemo(() => {
    const analyzedList: Finding[] = [];
    const notAnalyzedList: Finding[] = [];
    let themeCount = 0;
    for (const f of findings) {
      if (f.coverage === "NOT_ANALYZED") {
        if (f.notAnalyzedReason === "API_LIMITATION") {
          themeCount++;
        } else {
          notAnalyzedList.push(f);
        }
      } else {
        analyzedList.push(f);
      }
    }
    return { analyzed: analyzedList, notAnalyzed: notAnalyzedList, themeInheritedCount: themeCount };
  }, [findings]);

  const slideGroups = useMemo(() => groupBySlideId(analyzed), [analyzed]);
  const notAnalyzedByBucket = useMemo(() => groupNotAnalyzedByBucket(notAnalyzed), [notAnalyzed]);

  const orderedIds = useMemo(() => orderedSlideIdsForFindings(slideGroups, deck), [slideGroups, deck]);

  const showAllNotAnalyzedSummary =
    analyzed.length === 0 &&
    (notAnalyzed.length > 0 || themeInheritedCount > 0) &&
    coverage !== undefined &&
    coverage !== null;

  if (findings.length === 0) {
    return <p className="muted">No findings.</p>;
  }

  return (
    <div className="findings-panel">
      {analyzed.length > 0 ? (
        <section className="findings-panel__findings" aria-label="Findings">
          <h3 className="findings-panel__section-title">Findings</h3>
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
        </section>
      ) : null}

      {showAllNotAnalyzedSummary ? (
        <p className="findings-panel__coverage-summary muted">
          Magistrat checked {PLAYBOOK_RULE_COUNT} rules across {coverage.totalObjects} objects.{" "}
          {coverage.notAnalyzedObjects} objects couldn&apos;t be analyzed
          {themeInheritedCount > 0 ? ` (${themeInheritedCount} use theme formatting)` : ""}.
        </p>
      ) : null}

      {notAnalyzed.length > 0 ? (
        <details className="findings-panel__not-checked">
          <summary className="findings-panel__not-checked-summary">
            <span className="findings-panel__not-checked-label">Not checked</span>
            <span className="findings-panel__not-checked-count">{notAnalyzed.length}</span>
          </summary>
          <div className="findings-panel__not-checked-body">
            {BUCKET_ORDER.map((bucket) => {
              const bucketFindings = notAnalyzedByBucket.get(bucket);
              if (!bucketFindings || bucketFindings.length === 0) {
                return null;
              }
              return (
                <div key={bucket} className="findings-panel__bucket">
                  <h4 className="findings-panel__bucket-title">{NOT_ANALYZED_BUCKET_LABELS[bucket]}</h4>
                  <div className="findings-panel__bucket-list">
                    {bucketFindings.map((finding) => (
                      <FindingCard
                        key={finding.id}
                        finding={finding}
                        isIgnored={ignoredFindingIds?.has(finding.id) ?? false}
                        {...(onApplyFinding ? { onApply: () => onApplyFinding(finding.id) } : {})}
                        {...(onIgnoreFinding ? { onIgnore: () => onIgnoreFinding(finding.id) } : {})}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}
