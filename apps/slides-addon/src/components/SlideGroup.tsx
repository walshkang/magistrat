import type { Finding } from "@magistrat/shared-types";
import { FindingCard } from "./FindingCard.js";

export interface SlideGroupProps {
  slideId: string;
  slideIndex: number;
  slideLabel: string;
  findings: Finding[];
  onApplyFinding?: (findingId: string) => void;
  onIgnoreFinding?: (findingId: string) => void;
  ignoredFindingIds?: ReadonlySet<string>;
}

export function SlideGroup({
  slideId,
  slideIndex,
  slideLabel,
  findings,
  onApplyFinding,
  onIgnoreFinding,
  ignoredFindingIds
}: SlideGroupProps) {
  return (
    <details className="slide-group" open data-slide-id={slideId} data-slide-index={slideIndex}>
      <summary className="slide-group__summary">
        <span className="slide-group__label">{slideLabel}</span>
        <span className="slide-group__count">{findings.length}</span>
      </summary>
      <div className="slide-group__body">
        {findings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            isIgnored={ignoredFindingIds?.has(finding.id) ?? false}
            {...(onApplyFinding ? { onApply: () => onApplyFinding(finding.id) } : {})}
            {...(onIgnoreFinding ? { onIgnore: () => onIgnoreFinding(finding.id) } : {})}
          />
        ))}
      </div>
    </details>
  );
}
