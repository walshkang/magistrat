import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

interface OfficeTestContext {
  host?: string;
  platform?: string;
  requirements?: {
    isSetSupported?: (setName: string, minVersion?: string) => boolean;
  };
  document?: {
    url?: string;
  };
}

interface PowerPointTestGlobal {
  run?: (callback: (context: unknown) => Promise<unknown>) => Promise<unknown>;
}

const originalOffice = (globalThis as { Office?: unknown }).Office;
const originalPowerPoint = (globalThis as { PowerPoint?: unknown }).PowerPoint;

describe("office adapter public api", () => {
  beforeEach(() => {
    resetAdapterProviderForTests();
    restoreOfficeGlobals();
  });

  afterEach(() => {
    restoreOfficeGlobals();
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

  it("uses OFFICE_SHADOW when Office is present on unsupported web platform", () => {
    setOfficeContext({
      host: "PowerPoint",
      platform: "OfficeOnline",
      requirements: {
        isSetSupported: () => true
      }
    });

    const status = getRuntimeStatus();
    expect(status.mode).toBe("OFFICE_SHADOW");
    expect(status.capabilities.readDeckSnapshot.supported).toBe(false);
    expect(status.capabilities.readDeckSnapshot.reasonCode).toBe("PLATFORM_UNSUPPORTED");
  });

  it("uses OFFICE_SHADOW when desktop host lacks required PowerPointApi support", () => {
    setOfficeContext({
      host: "PowerPoint",
      platform: "PC",
      requirements: {
        isSetSupported: (_setName, minVersion) => minVersion === "1.6"
      }
    });
    setPowerPointContext({
      run: async (callback) => callback(createEmptyPowerPointContext())
    });

    const status = getRuntimeStatus();
    expect(status.mode).toBe("OFFICE_SHADOW");
    expect(status.capabilities.readDeckSnapshot.supported).toBe(false);
    expect(status.capabilities.readDeckSnapshot.reasonCode).toBe("REQUIREMENT_SET_UNSUPPORTED");
  });

  it("uses OFFICE_READONLY when desktop host satisfies read capability gates", async () => {
    setOfficeContext({
      host: "PowerPoint",
      platform: "PC",
      requirements: {
        isSetSupported: () => true
      }
    });
    setPowerPointContext({
      run: async (callback) => callback(createEmptyPowerPointContext())
    });

    const status = getRuntimeStatus();
    expect(status.mode).toBe("OFFICE_READONLY");
    expect(status.capabilities.readDeckSnapshot.supported).toBe(true);
    expect(status.capabilities.applyPatchOps.supported).toBe(false);
    expect(status.capabilities.applyPatchOps.reasonCode).toBe("POLICY_DISABLED");
    expect(status.capabilityRegistry.requirementSets.powerPointApi_1_4.supported).toBe(true);

    const snapshot = await readDeckSnapshot();
    expect(snapshot.slides).toEqual([]);
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

function setOfficeContext(context: OfficeTestContext): void {
  (globalThis as unknown as { Office?: { context?: OfficeTestContext } }).Office = {
    context
  };
}

function setPowerPointContext(powerPoint: PowerPointTestGlobal): void {
  (globalThis as unknown as { PowerPoint?: PowerPointTestGlobal }).PowerPoint = powerPoint;
}

function restoreOfficeGlobals(): void {
  const globalAny = globalThis as unknown as {
    Office?: unknown;
    PowerPoint?: unknown;
  };

  if (originalOffice === undefined) {
    delete globalAny.Office;
  } else {
    globalAny.Office = originalOffice;
  }

  if (originalPowerPoint === undefined) {
    delete globalAny.PowerPoint;
  } else {
    globalAny.PowerPoint = originalPowerPoint;
  }
}

function createEmptyPowerPointContext(): {
  presentation: {
    slides: {
      items: [];
      load: (_select: string) => void;
    };
  };
  sync: () => Promise<void>;
} {
  return {
    presentation: {
      slides: {
        items: [],
        load: (_select: string) => {
          return;
        }
      }
    },
    sync: async () => {
      return;
    }
  };
}
