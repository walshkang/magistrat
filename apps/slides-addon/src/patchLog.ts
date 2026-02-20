import { reconcilePatches } from "@magistrat/compiler-core";
import type { DeckSnapshot, PatchRecord, ReconcileState } from "@magistrat/shared-types";

export interface PatchLogGroup {
  appliedAtIso: string;
  records: PatchRecord[];
}

export type ReconcileStateCounts = Record<ReconcileState, number>;

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
