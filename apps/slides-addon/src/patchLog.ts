import { stableTargetFingerprint } from "@magistrat/google-adapter";
import { reconcilePatches } from "@magistrat/compiler-core";
import type { DeckSnapshot, PatchOp, PatchRecord, ReconcileSignature, ReconcileState } from "@magistrat/shared-types";

export interface PatchLogGroup {
  appliedAtIso: string;
  records: PatchRecord[];
}

export type ReconcileStateCounts = Record<ReconcileState, number>;

interface SafeRestoreShapeState extends Record<string, unknown> {
  fontFamily: string | null;
  fontColor: string | null;
  bold: boolean | null;
  italic: boolean | null;
  bulletIndent: number | null;
  bulletHanging: number | null;
}

export interface BuildSafeRestoreOpsResult {
  restoreOps: PatchOp[];
  reason?: string;
}

export function reconcilePatchLogByRecordIdentity(records: PatchRecord[], deck: DeckSnapshot): PatchRecord[] {
  const reconcileResults = reconcilePatches(records, deck);
  const nextStateByRecord = new Map<PatchRecord, ReconcileState>(
    reconcileResults.map((result) => [result.patch, result.nextState])
  );

  return records.map((record) => ({
    ...record,
    reconcileState: nextStateByRecord.get(record) ?? record.reconcileState
  }));
}

export function sortPatchRecordsNewestFirst(records: PatchRecord[]): PatchRecord[] {
  return records
    .map((record, index) => ({
      record,
      index
    }))
    .sort((left, right) => {
      const appliedAtDelta = compareIsoDescending(left.record.appliedAtIso, right.record.appliedAtIso);
      if (appliedAtDelta !== 0) {
        return appliedAtDelta;
      }

      const idDelta = left.record.id.localeCompare(right.record.id);
      if (idDelta !== 0) {
        return idDelta;
      }

      const findingIdDelta = left.record.findingId.localeCompare(right.record.findingId);
      if (findingIdDelta !== 0) {
        return findingIdDelta;
      }

      const slideDelta = left.record.targetFingerprint.slideId.localeCompare(right.record.targetFingerprint.slideId);
      if (slideDelta !== 0) {
        return slideDelta;
      }

      const objectDelta = left.record.targetFingerprint.objectId.localeCompare(right.record.targetFingerprint.objectId);
      if (objectDelta !== 0) {
        return objectDelta;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.record);
}

export function groupPatchRecordsByAppliedAtIso(records: PatchRecord[]): PatchLogGroup[] {
  const sorted = sortPatchRecordsNewestFirst(records);
  const groups: PatchLogGroup[] = [];

  for (const record of sorted) {
    const previousGroup = groups.at(-1);
    if (previousGroup?.appliedAtIso === record.appliedAtIso) {
      previousGroup.records.push(record);
      continue;
    }

    groups.push({
      appliedAtIso: record.appliedAtIso,
      records: [record]
    });
  }

  return groups;
}

export function countReconcileStates(records: PatchRecord[]): ReconcileStateCounts {
  const counts: ReconcileStateCounts = {
    applied: 0,
    reverted_externally: 0,
    drifted: 0,
    missing_target: 0
  };

  for (const record of records) {
    counts[record.reconcileState] += 1;
  }

  return counts;
}

export function countStateTransitions(previous: PatchRecord[], next: PatchRecord[]): number {
  const overlap = Math.min(previous.length, next.length);
  let changed = 0;

  for (let index = 0; index < overlap; index += 1) {
    if (previous[index]?.reconcileState !== next[index]?.reconcileState) {
      changed += 1;
    }
  }

  return changed + Math.abs(previous.length - next.length);
}

export function isEmptySignature(signature: Partial<ReconcileSignature> | undefined): boolean {
  return (
    (signature?.fontFamily ?? null) === null &&
    (signature?.fontSizePt ?? null) === null &&
    (signature?.fontColor ?? null) === null &&
    (signature?.bold ?? null) === null &&
    (signature?.italic ?? null) === null &&
    (signature?.bulletIndent ?? null) === null &&
    (signature?.bulletHanging ?? null) === null
  );
}

export function hasSafeRestoreDiff(record: PatchRecord): boolean {
  const before = record.before;
  const after = record.after;

  return (
    (typeof before.fontFamily === "string" && before.fontFamily !== after.fontFamily) ||
    (typeof before.fontColor === "string" && before.fontColor !== after.fontColor) ||
    (typeof before.bold === "boolean" && before.bold !== after.bold) ||
    (typeof before.italic === "boolean" && before.italic !== after.italic) ||
    (typeof before.bulletIndent === "number" && before.bulletIndent !== after.bulletIndent) ||
    (typeof before.bulletHanging === "number" && before.bulletHanging !== after.bulletHanging)
  );
}

export function getRestoreUiDisabledReason(
  record: PatchRecord,
  applyPatchSupported: boolean,
  applyPatchReason?: string
): string | undefined {
  if (!applyPatchSupported) {
    return applyPatchReason ?? "Patch apply is unavailable in this runtime mode.";
  }
  if (record.reconcileState !== "applied") {
    return `Restore is available only for applied patch records (current: ${record.reconcileState}).`;
  }
  if (isEmptySignature(record.after)) {
    return "Restore is unavailable for delete-like patch records in v1.";
  }
  if (!hasSafeRestoreDiff(record)) {
    return "Restore is unavailable because no safe fields can be restored.";
  }

  return undefined;
}

export function buildSafeRestoreOps(record: PatchRecord, deck: DeckSnapshot, nowIso: string): BuildSafeRestoreOpsResult {
  if (isEmptySignature(record.after)) {
    return {
      restoreOps: [],
      reason: "Restore is unavailable for delete-like patch records in v1."
    };
  }

  if (!hasSafeRestoreDiff(record)) {
    return {
      restoreOps: [],
      reason: "No safe restore operations were generated because there is no safe field diff."
    };
  }

  const shape = findShape(deck, record.targetFingerprint.slideId, record.targetFingerprint.objectId);
  if (!shape) {
    return {
      restoreOps: [],
      reason: `Restore target is missing in current deck snapshot (${record.targetFingerprint.slideId}:${record.targetFingerprint.objectId}).`
    };
  }

  const target = stableTargetFingerprint(
    record.targetFingerprint.slideId,
    record.targetFingerprint.objectId,
    buildSafeStateFromShape(shape)
  );

  const idSuffix = nowIso.replace(/[^0-9]/g, "");
  let sequence = 0;
  const restoreOps: PatchOp[] = [];

  if (typeof record.before.fontFamily === "string" && record.before.fontFamily !== record.after.fontFamily) {
    restoreOps.push({
      id: buildRestoreOpId(record.id, "SET_FONT_FAMILY", idSuffix, sequence++),
      op: "SET_FONT_FAMILY",
      target,
      fields: {
        fontFamily: record.before.fontFamily
      },
      risk: "safe"
    });
  }

  if (typeof record.before.fontColor === "string" && record.before.fontColor !== record.after.fontColor) {
    restoreOps.push({
      id: buildRestoreOpId(record.id, "SET_FONT_COLOR", idSuffix, sequence++),
      op: "SET_FONT_COLOR",
      target,
      fields: {
        fontColor: record.before.fontColor
      },
      risk: "safe"
    });
  }

  const restoreStyleFields: PatchOp["fields"] = {
    ...(typeof record.before.bold === "boolean" && record.before.bold !== record.after.bold
      ? { bold: record.before.bold }
      : {}),
    ...(typeof record.before.italic === "boolean" && record.before.italic !== record.after.italic
      ? { italic: record.before.italic }
      : {})
  };

  if (Object.keys(restoreStyleFields).length > 0) {
    restoreOps.push({
      id: buildRestoreOpId(record.id, "SET_FONT_STYLE", idSuffix, sequence++),
      op: "SET_FONT_STYLE",
      target,
      fields: restoreStyleFields,
      risk: "safe"
    });
  }

  const restoreBulletFields: PatchOp["fields"] = {
    ...(typeof record.before.bulletIndent === "number" && record.before.bulletIndent !== record.after.bulletIndent
      ? { bulletIndent: record.before.bulletIndent }
      : {}),
    ...(typeof record.before.bulletHanging === "number" && record.before.bulletHanging !== record.after.bulletHanging
      ? { bulletHanging: record.before.bulletHanging }
      : {})
  };

  if (Object.keys(restoreBulletFields).length > 0) {
    restoreOps.push({
      id: buildRestoreOpId(record.id, "SET_BULLET_INDENT", idSuffix, sequence++),
      op: "SET_BULLET_INDENT",
      target,
      fields: restoreBulletFields,
      risk: "safe"
    });
  }

  if (restoreOps.length === 0) {
    return {
      restoreOps: [],
      reason: "No safe restore operations were generated from the current patch record."
    };
  }

  return {
    restoreOps
  };
}

function compareIsoDescending(left: string, right: string): number {
  const leftTimestamp = Date.parse(left);
  const rightTimestamp = Date.parse(right);

  if (Number.isFinite(leftTimestamp) && Number.isFinite(rightTimestamp) && leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  if (left === right) {
    return 0;
  }

  return right.localeCompare(left);
}

function findShape(
  deck: DeckSnapshot,
  slideId: string,
  objectId: string
): DeckSnapshot["slides"][number]["shapes"][number] | undefined {
  const slide = deck.slides.find((candidate) => candidate.slideId === slideId);
  return slide?.shapes.find((candidate) => candidate.objectId === objectId);
}

function buildRestoreOpId(recordId: string, op: PatchOp["op"], idSuffix: string, sequence: number): string {
  return `restore-${recordId}-${op.toLowerCase()}-${idSuffix}-${sequence}`;
}

function buildSafeStateFromShape(shape: DeckSnapshot["slides"][number]["shapes"][number]): SafeRestoreShapeState {
  const run = shape.textRuns[0];
  const paragraph = shape.paragraphs[0];

  return {
    fontFamily: run?.fontFamily ?? null,
    fontColor: run?.fontColor ?? null,
    bold: run?.bold ?? null,
    italic: run?.italic ?? null,
    bulletIndent: typeof paragraph?.bulletIndent === "number" ? paragraph.bulletIndent : null,
    bulletHanging: typeof paragraph?.bulletHanging === "number" ? paragraph.bulletHanging : null
  };
}
