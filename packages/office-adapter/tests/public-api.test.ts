import { beforeEach, describe, expect, it } from "vitest";
import type { DocumentStateV1 } from "@magistrat/shared-types";
import {
  applyPatchOps,
  getRuntimeStatus,
  loadDocumentState,
  readDeckSnapshot,
  resetAdapterProviderForTests,
  saveDocumentState,
  stableTargetFingerprint
} from "../src/public-api.js";

describe("office adapter public api", () => {
  beforeEach(() => {
    resetAdapterProviderForTests();
  });

  it("migrates normalized exemplar mode to token_normalized", async () => {
    const state: DocumentStateV1 = {
      schemaVersion: 1,
      lastUpdatedIso: "2026-02-17T00:00:00.000Z",
      findings: [],
      patchLog: [],
      exemplar: {
        slideId: "slide-2",
        mode: "normalized" as unknown as "token_normalized",
        normalizationAppliedToSlide: false,
        selectedAtIso: "2026-02-17T00:00:00.000Z"
      }
    };

    await saveDocumentState(state);
    const loaded = await loadDocumentState();

    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.exemplar?.slideId).toBe("slide-2");
    expect(loaded.exemplar?.mode).toBe("token_normalized");
  });

  it("uses SIM runtime mode when Office host is unavailable", () => {
    const status = getRuntimeStatus();
    expect(status.mode).toBe("SIM");
    expect(status.hostCapabilities.officeAvailable).toBe(false);
    expect(status.capabilities.readDeckSnapshot.supported).toBe(true);
    expect(status.capabilities.applyPatchOps.supported).toBe(true);
  });

  it("applies safe patch ops against mutable SIM deck and records signatures", async () => {
    const initialDeck = await readDeckSnapshot();
    const initialShape = initialDeck.slides[0]?.shapes.find((shape) => shape.objectId === "shape-title");
    expect(initialShape?.textRuns[0]?.fontFamily).toBe("Aptos Display");

    const result = await applyPatchOps([
      {
        id: "patch-1",
        op: "SET_FONT_FAMILY",
        target: {
          slideId: "slide-1",
          objectId: "shape-title",
          preconditionHash: "h123"
        },
        fields: {
          fontFamily: "Aptos"
        },
        risk: "safe"
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.before.fontFamily).toBe("Aptos Display");
    expect(result[0]?.after.fontFamily).toBe("Aptos");
    expect(result[0]?.reconcileState).toBe("applied");

    const nextDeck = await readDeckSnapshot();
    const nextShape = nextDeck.slides[0]?.shapes.find((shape) => shape.objectId === "shape-title");
    expect(nextShape?.textRuns[0]?.fontFamily).toBe("Aptos");
  });

  it("creates stable target fingerprints", () => {
    const a = stableTargetFingerprint("slide-1", "shape-1", { x: 1, y: 2 });
    const b = stableTargetFingerprint("slide-1", "shape-1", { y: 2, x: 1 });

    expect(a.preconditionHash).toBe(b.preconditionHash);
  });
});
