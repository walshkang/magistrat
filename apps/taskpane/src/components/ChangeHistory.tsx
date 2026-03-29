import type { DeckSnapshot, Finding, PatchRecord, ReconcileState } from "@magistrat/shared-types";
import { useMemo } from "react";
import { groupPatchRecordsByAppliedAtIso } from "../patchLog.js";

export interface ChangeHistoryProps {
  patchLog: PatchRecord[];
  findings: Finding[];
  deck: DeckSnapshot | null;
  onReconcile: () => void;
  reconcileDisabled: boolean;
  reconcileTitle?: string;
}

function styleDesc(bold: boolean | null, italic: boolean | null): string {
  if (bold && italic) {
    return "bold italic";
  }
  if (bold) {
    return "bold";
  }
  if (italic) {
    return "italic";
  }
  return "regular";
}

/** Single-category labels from ReconcileSignature diffs; multiple categories → generic. */
export function inferChangeLabel(record: PatchRecord): string {
  const { before, after } = record;
  const categories: string[] = [];

  if (before.fontFamily !== after.fontFamily) {
    categories.push("family");
  }
  if (before.fontColor !== after.fontColor) {
    categories.push("color");
  }
  if (before.bold !== after.bold || before.italic !== after.italic) {
    categories.push("style");
  }
  if (before.fontSizePt !== after.fontSizePt) {
    categories.push("size");
  }
  if (before.bulletIndent !== after.bulletIndent || before.bulletHanging !== after.bulletHanging) {
    categories.push("bullet");
  }

  if (categories.length === 0 || categories.length > 1) {
    return "Applied style fix";
  }

  switch (categories[0]) {
    case "family":
      return `Fixed font family: ${before.fontFamily} → ${after.fontFamily}`;
    case "color":
      return `Fixed font color: ${before.fontColor} → ${after.fontColor}`;
    case "style":
      return `Fixed font style: ${styleDesc(before.bold, before.italic)} → ${styleDesc(after.bold, after.italic)}`;
    case "size":
      return `Fixed font size: ${before.fontSizePt}pt → ${after.fontSizePt}pt`;
    case "bullet":
      return "Fixed bullet indentation";
    default:
      return "Applied style fix";
  }
}

function reconcileAnnotation(state: ReconcileState): string {
  switch (state) {
    case "applied":
      return "";
    case "reverted_externally":
      return " (reverted externally)";
    case "drifted":
      return " (drifted)";
    case "missing_target":
      return " (target missing)";
    default:
      return "";
  }
}

export function translatePatchRecord(
  record: PatchRecord,
  deck: DeckSnapshot | null,
  findings: Finding[]
): { label: string; detail: string } {
  const base = inferChangeLabel(record);
  const label = `${base}${reconcileAnnotation(record.reconcileState)}`;

  const slide = deck?.slides.find((s) => s.slideId === record.targetFingerprint.slideId);
  const slidePart = slide ? `Slide ${slide.index}` : `Slide ${record.targetFingerprint.slideId}`;
  const titlePart = slide?.title ? ` · ${slide.title}` : "";
  const finding = findings.find((f) => f.id === record.findingId);
  const rolePart = finding?.role ? ` · ${finding.role}` : "";

  return {
    label,
    detail: `${slidePart}${titlePart}${rolePart}`
  };
}

function stateIcon(state: ReconcileState): string {
  switch (state) {
    case "applied":
      return "✓";
    case "reverted_externally":
      return "⟳";
    case "drifted":
      return "⚠";
    case "missing_target":
      return "✕";
    default:
      return "•";
  }
}

function calendarDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatGroupDateLine(appliedAtIso: string, previousDayKey: string | null): { text: string; dayKey: string } {
  const d = new Date(appliedAtIso);
  const dayKey = calendarDayKey(appliedAtIso);
  if (previousDayKey === dayKey) {
    const timeOnly = new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(d);
    return { text: timeOnly, dayKey };
  }
  const full = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(d);
  return { text: full, dayKey };
}

export function ChangeHistory({
  patchLog,
  findings,
  deck,
  onReconcile,
  reconcileDisabled,
  reconcileTitle
}: ChangeHistoryProps) {
  const groups = useMemo(() => groupPatchRecordsByAppliedAtIso(patchLog), [patchLog]);

  const groupRows = useMemo(() => {
    let previousDayKey: string | null = null;
    return groups.map((group) => {
      const { text, dayKey } = formatGroupDateLine(group.appliedAtIso, previousDayKey);
      previousDayKey = dayKey;
      return { group, dateLine: text };
    });
  }, [groups]);

  const detailsOpenDefault = groups.length <= 3;

  return (
    <details className="change-history-details" open={detailsOpenDefault}>
      <summary className="change-history__title change-history-details__summary">Change history</summary>
      <section className="change-history">
        {groupRows.map(({ group, dateLine }) => (
          <div className="change-history__group" key={group.appliedAtIso}>
            <p className="change-history__date">
              {dateLine} — {group.records.length} {group.records.length === 1 ? "change" : "changes"}
            </p>
            <ul className="change-history__list">
              {group.records.map((record) => {
                const { label, detail } = translatePatchRecord(record, deck, findings);
                return (
                  <li className="change-history__item" key={record.id}>
                    <span className={`change-history__icon change-history__icon--${record.reconcileState}`}>
                      {stateIcon(record.reconcileState)}
                    </span>
                    <div>
                      <p className="change-history__label">{label}</p>
                      <p className="change-history__detail">{detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <button
          type="button"
          className="btn-ghost"
          onClick={onReconcile}
          disabled={reconcileDisabled}
          title={reconcileTitle}
        >
          Reconcile
        </button>
      </section>
    </details>
  );
}
