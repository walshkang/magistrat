import type { CandidateRule, RoleV1 } from "@magistrat/shared-types";
import { ROLE_V1_VALUES } from "@magistrat/shared-types";

function formatRole(role: RoleV1): string {
  const map: Record<string, string> = {
    TITLE: "Title",
    SUBTITLE: "Subtitle",
    BODY: "Body",
    BULLET_L1: "Bullet L1",
    BULLET_L2: "Bullet L2",
    FOOTER: "Footer",
    CALLOUT: "Callout"
  };
  return map[role] ?? role;
}

export function groupCandidatesByRole(candidates: CandidateRule[]): Map<RoleV1, CandidateRule[]> {
  const map = new Map<RoleV1, CandidateRule[]>();
  for (const c of candidates) {
    const list = map.get(c.role);
    if (list) list.push(c);
    else map.set(c.role, [c]);
  }
  return map;
}

export interface RuleConfirmationPanelProps {
  candidates: CandidateRule[];
  onCandidatesChange: (next: CandidateRule[]) => void;
  onConfirm: () => void;
  onUseDefaults: () => void;
  disabled?: boolean;
}

export function RuleConfirmationPanel({
  candidates,
  onCandidatesChange,
  onConfirm,
  onUseDefaults,
  disabled
}: RuleConfirmationPanelProps) {
  const grouped = groupCandidatesByRole(candidates);

  return (
    <section className="panel rule-confirmation-panel" aria-label="Confirm inferred rules">
      <div className="panel-header">
        <h2>Confirm rules</h2>
      </div>
      <p className="muted rule-confirmation-panel__subtitle">
        Review what Magistrat inferred from your exemplar. Turn off anything you don’t want enforced.
      </p>

      <div className="rule-confirmation-panel__roles">
        {ROLE_V1_VALUES.filter((r) => r !== "UNKNOWN").map((role) => {
          const list = grouped.get(role);
          if (!list || list.length === 0) return null;
          return (
            <section className="rule-confirmation-role" key={role} aria-label={`${formatRole(role)} rules`}>
              <h3 className="rule-confirmation-role__title">{formatRole(role)}</h3>
              <ul className="rule-confirmation-role__list">
                {list.map((rule, index) => {
                  const inputId = `rule-toggle-${rule.id}`;
                  return (
                    <li className="rule-confirmation-row" key={`${rule.id}-${index}`}>
                      <label className="rule-confirmation-row__label" htmlFor={inputId}>
                        {rule.label}
                      </label>
                      <span className="rule-confirmation-row__toggle">
                        <input
                          id={inputId}
                          className="switch-input"
                          type="checkbox"
                          role="switch"
                          checked={rule.enabled}
                          disabled={disabled}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            onCandidatesChange(
                              candidates.map((c) => (c.id === rule.id ? { ...c, enabled } : c))
                            );
                          }}
                        />
                        <span className="switch-ui" aria-hidden="true" />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="rule-confirmation-panel__actions">
        <button type="button" className="btn-primary" onClick={onConfirm} disabled={disabled}>
          Confirm rules
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={onUseDefaults} disabled={disabled}>
          Use defaults
        </button>
      </div>
    </section>
  );
}

