import { translateFinding } from "@magistrat/compiler-core";
import type { Finding } from "@magistrat/shared-types";
import { useDevMode } from "../context/DevModeContext.js";

const RISK_BADGE_CLASS: Record<Finding["risk"], string> = {
  safe: "risk-badge risk-badge--safe",
  caution: "risk-badge risk-badge--caution",
  manual: "risk-badge risk-badge--manual"
};

function findingCardModifierClass(finding: Finding): string {
  if (finding.coverage === "NOT_ANALYZED") {
    return "finding-card--not-analyzed";
  }
  return `finding-card--${finding.severity}`;
}

export interface FindingCardProps {
  finding: Finding;
  onApply?: () => void;
  onIgnore?: () => void;
  isIgnored?: boolean;
}

export function FindingCard({ finding, onApply, onIgnore, isIgnored }: FindingCardProps) {
  const { devMode } = useDevMode();
  const translated = translateFinding(finding);
  const modifier = findingCardModifierClass(finding);
  const applyButtonClass = finding.risk === "safe" ? "btn-primary btn-sm" : "btn-secondary btn-sm";
  const ignoredClass = isIgnored ? " finding-card--ignored" : "";

  return (
    <article className={`finding-card ${modifier}${ignoredClass}`}>
      <div className="finding-card__header">
        <h3 className="finding-card__title">{translated.title}</h3>
        <span className={RISK_BADGE_CLASS[finding.risk]}>{translated.riskLabel}</span>
      </div>

      <p className="finding-card__description">{translated.description}</p>

      {devMode ? (
        <div className="finding-card__dev muted">
          <div>
            <code>{finding.ruleId}</code>
            {finding.objectId ? (
              <>
                {" "}
                · object <code>{finding.objectId}</code>
              </>
            ) : null}
          </div>
          <div>
            confidence {Math.round(finding.confidence * 100)}%
            {finding.coverage === "NOT_ANALYZED" && finding.notAnalyzedReason ? (
              <>
                {" "}
                · NOT_ANALYZED: <code>{finding.notAnalyzedReason}</code>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {(translated.actionLabel !== null && onApply) ||
      (!isIgnored && onIgnore && finding.coverage === "ANALYZED") ||
      isIgnored ? (
        <div className="finding-card__actions">
          {translated.actionLabel !== null && onApply ? (
            <button type="button" className={applyButtonClass} onClick={onApply}>
              {translated.actionLabel}
            </button>
          ) : null}
          {!isIgnored && onIgnore && finding.coverage === "ANALYZED" ? (
            <button type="button" className="btn-ghost btn-sm" onClick={onIgnore}>
              Ignore
            </button>
          ) : null}
          {isIgnored ? <span className="finding-card__ignored-badge">Ignored</span> : null}
        </div>
      ) : null}
    </article>
  );
}
