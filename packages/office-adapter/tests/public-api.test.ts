import { describe, expect, it } from "vitest";
import type { DocumentStateV1 } from "@magistrat/shared-types";
import {
  applyPatchOps,
  getHostCapabilities,
  loadDocumentState,
  saveDocumentState,
  stableTargetFingerprint
} from "../src/public-api.js";

describe("office adapter public api", () => {
  it("round-trips document state in memory when Office is unavailable", async () => {
    const state: DocumentStateV1 = {
      schemaVersion: 1,
      lastUpdatedIso: "2026-02-17T00:00:00.000Z",
      findings: [],
      patchLog: [],
      exemplar: {
        slideId: "slide-2",
        mode: "normalized",
        normalizationAppliedToSlide: false,
        selectedAtIso: "2026-02-17T00:00:00.000Z"
      }
    };

    await saveDocumentState(state);
    const loaded = await loadDocumentState();

    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.exemplar?.slideId).toBe("slide-2");
  });

  it("classifies environment as unsupported when Office host is absent", () => {
    const caps = getHostCapabilities();
    expect(caps.officeAvailable).toBe(false);
    expect(caps.desktopSupported).toBe(false);
  });

  it("creates applied patch records", async () => {
    const patchId = "patch-1";
    const result = await applyPatchOps([
      {
        id: patchId,
        op: "SET_FONT_FAMILY",
        target: {
          slideId: "slide-1",
          objectId: "shape-1",
          preconditionHash: "h123"
        },
        fields: {
          fontFamily: "Aptos"
        },
        risk: "safe"
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(patchId);
    expect(result[0]?.reconcileState).toBe("applied");
  });

  it("creates stable target fingerprints", () => {
    const a = stableTargetFingerprint("slide-1", "shape-1", { x: 1, y: 2 });
    const b = stableTargetFingerprint("slide-1", "shape-1", { y: 2, x: 1 });

    expect(a.preconditionHash).toBe(b.preconditionHash);
  });
});
