import { reconcilePatches } from "@magistrat/compiler-core";
import type { DeckSnapshot, PatchRecord, ReconcileState } from "@magistrat/shared-types";

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
