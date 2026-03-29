import type { PatchRecord } from "@magistrat/shared-types";

export function getPartialAppliedRecords(error: unknown): PatchRecord[] {
  if (!error || typeof error !== "object") {
    return [];
  }

  const candidate = error as { partialAppliedRecords?: unknown };
  if (!Array.isArray(candidate.partialAppliedRecords)) {
    return [];
  }

  return candidate.partialAppliedRecords.filter(isPatchRecord);
}

function isPatchRecord(value: unknown): value is PatchRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PatchRecord> & { targetFingerprint?: unknown };
  return (
    typeof candidate.id === "string" &&
    typeof candidate.findingId === "string" &&
    typeof candidate.appliedAtIso === "string" &&
    isReconcileState(candidate.reconcileState) &&
    hasTargetFingerprint(candidate.targetFingerprint)
  );
}

function isReconcileState(value: unknown): value is PatchRecord["reconcileState"] {
  return value === "applied" || value === "reverted_externally" || value === "drifted" || value === "missing_target";
}

function hasTargetFingerprint(value: unknown): value is PatchRecord["targetFingerprint"] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as PatchRecord["targetFingerprint"];
  return (
    typeof candidate.slideId === "string" &&
    typeof candidate.objectId === "string" &&
    typeof candidate.preconditionHash === "string"
  );
}
