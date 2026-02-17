import type { Finding, PatchOp } from "@magistrat/shared-types";
import { CAUTION_PATCH_OPS, MANUAL_PATCH_OPS, SAFE_PATCH_OPS } from "./constants.js";

export interface PatchPlan {
  safe: PatchOp[];
  caution: PatchOp[];
  manual: PatchOp[];
}

export function planPatches(findings: Finding[], suggestedPatches: PatchOp[]): PatchPlan {
  const byId = new Map(suggestedPatches.map((patch) => [patch.id, patch]));

  const safe: PatchOp[] = [];
  const caution: PatchOp[] = [];
  const manual: PatchOp[] = [];

  for (const finding of findings) {
    if (!finding.suggestedPatchId) {
      continue;
    }
    if (finding.coverage === "NOT_ANALYZED") {
      continue;
    }

    const patch = byId.get(finding.suggestedPatchId);
    if (!patch) {
      continue;
    }

    if (SAFE_PATCH_OPS.has(patch.op)) {
      safe.push({ ...patch, risk: "safe" });
    } else if (CAUTION_PATCH_OPS.has(patch.op)) {
      caution.push({ ...patch, risk: "caution" });
    } else if (MANUAL_PATCH_OPS.has(patch.op)) {
      manual.push({ ...patch, risk: "manual" });
    } else {
      manual.push({ ...patch, risk: "manual" });
    }
  }

  return {
    safe,
    caution,
    manual
  };
}
