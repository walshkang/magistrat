import { translateFinding } from "@magistrat/compiler-core";
import type { Finding, IgnoredFinding } from "@magistrat/shared-types";

export interface ExceptionsPanelProps {
  ignoredFindings: IgnoredFinding[];
  findings: Finding[];
  onUnignore: (findingId: string) => void;
}

export function ExceptionsPanel({ ignoredFindings, findings, onUnignore }: ExceptionsPanelProps) {
  const findingIds = new Set(findings.map((f) => f.id));
  const activeIgnored = ignoredFindings.filter((ig) => findingIds.has(ig.findingId));
  const staleIgnored = ignoredFindings.filter((ig) => !findingIds.has(ig.findingId));

  if (ignoredFindings.length === 0) {
    return null;
  }

  return (
    <section className="exceptions-panel">
      <h2 className="exceptions-panel__title">Ignored findings ({activeIgnored.length})</h2>
      <p className="exceptions-panel__subtitle">These findings don&apos;t affect your alignment score.</p>
      <ul className="exceptions-panel__list">
        {activeIgnored.map((ig) => {
          const finding = findings.find((f) => f.id === ig.findingId);
          const translated = finding ? translateFinding(finding) : null;
          return (
            <li key={ig.findingId} className="exceptions-panel__item">
              <div>
                <p className="exceptions-panel__label">{translated?.title ?? `Finding ${ig.findingId}`}</p>
                <p className="exceptions-panel__meta">
                  Ignored {new Date(ig.ignoredAtIso).toLocaleDateString()}
                  {ig.note ? ` — ${ig.note}` : ""}
                </p>
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => onUnignore(ig.findingId)}>
                Restore
              </button>
            </li>
          );
        })}
      </ul>
      {staleIgnored.length > 0 ? (
        <p className="exceptions-panel__stale muted">
          {staleIgnored.length} previously ignored {staleIgnored.length === 1 ? "finding" : "findings"} no longer
          detected.
        </p>
      ) : null}
    </section>
  );
}
