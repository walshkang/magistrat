import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reconcilePatches } from "@magistrat/compiler-core";
import type {
  DocumentStateV1,
  PatchOp,
  PatchRecord
} from "@magistrat/shared-types";
import {
  applyPatchOps,
  getPartialAppliedRecords,
  getRuntimeStatus,
  loadDocumentState,
  readDeckSnapshot,
  resetAdapterProviderForTests,
  saveDocumentState,
  setGoogleSlidesBridgeForTests,
  stableTargetFingerprint
} from "../src/public-api.js";
import type {
  BridgeMutation,
  GoogleBridgePresentation,
  GoogleSlidesBridge
} from "../src/bridge-types.js";

describe("google adapter public api", () => {
  beforeEach(() => {
    setGoogleSlidesBridgeForTests(undefined);
    resetAdapterProviderForTests();
  });

  afterEach(() => {
    setGoogleSlidesBridgeForTests(undefined);
    resetAdapterProviderForTests();
  });

  it("uses SIM runtime mode when Google bridge is unavailable", async () => {
    const status = getRuntimeStatus();
    expect(status.mode).toBe("SIM");
    expect(status.hostCapabilities.bridgeAvailable).toBe(false);
    expect(status.capabilities.readDeckSnapshot.supported).toBe(true);
    expect(status.capabilities.applyPatchOps.supported).toBe(true);

    const snapshot = await readDeckSnapshot();
    expect(snapshot.slides.length).toBeGreaterThan(0);
  });

  it("persists and loads document state using hidden marker blocks", async () => {
    const bridge = createMutableBridge(createBasePresentation());
    bridge.carrier = "prefix content\nfooter content";
    setGoogleSlidesBridgeForTests(bridge.api);

    const state: DocumentStateV1 = {
      schemaVersion: 1,
      lastUpdatedIso: "2026-02-18T00:00:00.000Z",
      findings: [],
      patchLog: [],
      exemplar: {
        slideId: "slide-1",
        mode: "normalized" as unknown as "token_normalized",
        normalizationAppliedToSlide: false,
        selectedAtIso: "2026-02-18T00:00:00.000Z"
      }
    };

    await saveDocumentState(state);
    const loaded = await loadDocumentState();

    expect(loaded.exemplar?.mode).toBe("token_normalized");
    expect(bridge.carrier).toContain("MAGISTRAT_STATE_V1_START");
    expect(bridge.carrier).toContain("prefix content");
    expect(bridge.carrier).toContain("footer content");
  });

  it("uses GOOGLE_READONLY mode when bridge cannot apply patches", async () => {
    const bridge = createMutableBridge(createBasePresentation(), {
      applyPatchOps: false
    });
    setGoogleSlidesBridgeForTests(bridge.api);

    const status = getRuntimeStatus();
    expect(status.mode).toBe("GOOGLE_READONLY");
    expect(status.capabilities.readDeckSnapshot.supported).toBe(true);
    expect(status.capabilities.applyPatchOps.supported).toBe(false);

    const snapshot = await readDeckSnapshot();
    expect(snapshot.slides[0]?.slideId).toBe("slide-1");
  });

  it("applies safe operations and rejects caution/manual ops", async () => {
    const bridge = createMutableBridge(createBasePresentation());
    setGoogleSlidesBridgeForTests(bridge.api);

    const safeResult = await applyPatchOps([
      createPatch({
        id: "patch-safe",
        op: "SET_FONT_FAMILY",
        target: {
          slideId: "slide-1",
          objectId: "shape-title",
          preconditionHash: "h1"
        },
        fields: {
          fontFamily: "Lato"
        }
      })
    ]);

    expect(safeResult).toHaveLength(1);
    expect(safeResult[0]?.before.fontFamily).toBe("Aptos Display");
    expect(safeResult[0]?.after.fontFamily).toBe("Lato");
    expect(safeResult[0]?.reconcileState).toBe("applied");

    await expect(
      applyPatchOps([
        createPatch({
          id: "patch-caution",
          op: "SET_FONT_SIZE",
          target: {
            slideId: "slide-1",
            objectId: "shape-title",
            preconditionHash: "h2"
          },
          fields: {
            fontSizePt: 19
          }
        })
      ])
    ).rejects.toThrow("not apply-eligible");
  });

  it("fails clearly on revision mismatch", async () => {
    const bridge = createMutableBridge(createBasePresentation(), {
      forceRevisionMismatch: true
    });
    setGoogleSlidesBridgeForTests(bridge.api);

    await expect(
      applyPatchOps([
        createPatch({
          id: "patch-revision",
          op: "SET_FONT_COLOR",
          target: {
            slideId: "slide-1",
            objectId: "shape-title",
            preconditionHash: "h3"
          },
          fields: {
            fontColor: "#445566"
          }
        })
      ])
    ).rejects.toThrow("revision mismatch");
  });

  it("chunks apply calls with revision progression and deterministic mutation ordering", async () => {
    const bridge = createMutableBridge(createBasePresentation());
    setGoogleSlidesBridgeForTests(bridge.api);

    const patches = createSafeColorPatches(160);
    const result = await applyPatchOps(patches);
    const applyCalls = bridge.getApplyCalls();

    expect(result).toHaveLength(160);
    expect(applyCalls.map((call) => call.patchIds.length)).toEqual([75, 75, 10]);
    expect(applyCalls.map((call) => call.requiredRevisionId)).toEqual(["r1", "r2", "r3"]);
    expect(applyCalls.flatMap((call) => call.patchIds)).toEqual(patches.map((patch) => patch.id));
  });

  it("refreshes revision guard from readPresentation when apply result omits revision id", async () => {
    const bridge = createMutableBridge(createBasePresentation(), {
      omitResultRevisionId: true
    });
    setGoogleSlidesBridgeForTests(bridge.api);

    await applyPatchOps(createSafeColorPatches(160));
    const applyCalls = bridge.getApplyCalls();

    expect(applyCalls.map((call) => call.requiredRevisionId)).toEqual(["r1", "r2", "r3"]);
  });

  it("exposes partial applied records when a later chunk fails", async () => {
    const bridge = createMutableBridge(createBasePresentation(), {
      forceRevisionMismatchAtCall: 3
    });
    setGoogleSlidesBridgeForTests(bridge.api);

    const patches = createSafeColorPatches(160);
    let capturedError: unknown;

    try {
      await applyPatchOps(patches);
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toContain("revision mismatch");

    const partialApplied = getPartialAppliedRecords(capturedError);
    expect(partialApplied).toHaveLength(150);
    expect(partialApplied.map((record) => record.id)).toEqual(patches.slice(0, 150).map((patch) => patch.id));
  });

  it("supports reconcile transitions based on refreshed snapshots", async () => {
    const bridge = createMutableBridge(createBasePresentation());
    setGoogleSlidesBridgeForTests(bridge.api);

    const applyResult = await applyPatchOps([
      createPatch({
        id: "patch-reconcile",
        op: "SET_FONT_COLOR",
        target: {
          slideId: "slide-1",
          objectId: "shape-title",
          preconditionHash: "h4"
        },
        fields: {
          fontColor: "#AA0000"
        }
      })
    ]);

    const patchRecord = applyResult[0] as PatchRecord;
    expect(patchRecord.reconcileState).toBe("applied");

    bridge.mutateShape("slide-1", "shape-title", (shape) => {
      if (shape.text?.runs?.[0]) {
        shape.text.runs[0].fontColor = "#112233";
      }
    });

    const revertedSnapshot = await readDeckSnapshot();
    const reverted = reconcilePatches([patchRecord], revertedSnapshot);
    expect(reverted[0]?.nextState).toBe("reverted_externally");

    bridge.mutateShape("slide-1", "shape-title", (shape) => {
      if (shape.text?.runs?.[0]) {
        shape.text.runs[0].fontColor = "#00AA00";
      }
    });

    const driftedSnapshot = await readDeckSnapshot();
    const drifted = reconcilePatches([patchRecord], driftedSnapshot);
    expect(drifted[0]?.nextState).toBe("drifted");

    bridge.removeShape("slide-1", "shape-title");
    const missingSnapshot = await readDeckSnapshot();
    const missing = reconcilePatches([patchRecord], missingSnapshot);
    expect(missing[0]?.nextState).toBe("missing_target");
  });

  it("creates stable target fingerprints", () => {
    const a = stableTargetFingerprint("slide-1", "shape-1", { x: 1, y: 2 });
    const b = stableTargetFingerprint("slide-1", "shape-1", { y: 2, x: 1 });

    expect(a.preconditionHash).toBe(b.preconditionHash);
  });
});

function createPatch(input: {
  id: string;
  op: PatchOp["op"];
  target: PatchOp["target"];
  fields: PatchOp["fields"];
}): PatchOp {
  return {
    id: input.id,
    op: input.op,
    target: input.target,
    fields: input.fields,
    risk: "safe"
  };
}

function createSafeColorPatches(count: number): PatchOp[] {
  return Array.from({ length: count }, (_, index) =>
    createPatch({
      id: `patch-bulk-${index + 1}`,
      op: "SET_FONT_COLOR",
      target: {
        slideId: "slide-1",
        objectId: "shape-title",
        preconditionHash: `h-bulk-${index + 1}`
      },
      fields: {
        fontColor: `#${(index % 256).toString(16).padStart(2, "0")}2244`
      }
    })
  );
}

function createBasePresentation(): GoogleBridgePresentation {
  return {
    documentId: "google-doc-1",
    revisionId: "r1",
    slides: [
      {
        slideId: "slide-1",
        index: 1,
        title: "Agenda",
        pageElements: [
          {
            objectId: "shape-title",
            name: "Title",
            elementType: "TEXT_BOX",
            visible: true,
            grouped: false,
            zIndex: 1,
            geometry: {
              left: 10,
              top: 20,
              width: 600,
              height: 80,
              rotation: 0
            },
            text: {
              runs: [
                {
                  text: "Agenda",
                  fontFamily: "Aptos Display",
                  fontSizePt: 30,
                  bold: true,
                  italic: false,
                  fontColor: "#112233",
                  fontAlpha: 1
                }
              ],
              paragraphs: [
                {
                  level: 0,
                  text: "Agenda"
                }
              ],
              inspectability: {
                typography: true,
                bullets: true
              },
              autofitEnabled: false
            }
          }
        ]
      }
    ]
  };
}

function createMutableBridge(
  initialPresentation: GoogleBridgePresentation,
  options?: {
    applyPatchOps?: boolean;
    forceRevisionMismatch?: boolean;
    forceRevisionMismatchAtCall?: number;
    omitResultRevisionId?: boolean;
  }
): {
  api: GoogleSlidesBridge;
  carrier: string;
  getApplyCalls: () => Array<{ requiredRevisionId?: string; patchIds: string[] }>;
  mutateShape: (
    slideId: string,
    objectId: string,
    mutator: (shape: GoogleBridgePresentation["slides"][number]["pageElements"][number]) => void
  ) => void;
  removeShape: (slideId: string, objectId: string) => void;
} {
  const state = {
    presentation: clone(initialPresentation),
    revisionCounter: 1,
    carrier: "",
    applyCallCount: 0,
    applyCalls: [] as Array<{ requiredRevisionId?: string; patchIds: string[] }>
  };

  const api: GoogleSlidesBridge = {
    getHostInfo: () => ({
      host: "google_slides",
      platform: "web",
      documentId: state.presentation.documentId
    }),
    getCapabilities: () => ({
      readDeckSnapshot: true,
      applyPatchOps: options?.applyPatchOps ?? true,
      documentStateCarrier: true,
      revisionGuard: true
    }),
    readPresentation: async () => {
      return {
        ...clone(state.presentation),
        revisionId: `r${state.revisionCounter}`
      };
    },
    applyMutations: async (mutations: BridgeMutation[], applyOptions: { requiredRevisionId?: string }) => {
      state.applyCallCount += 1;
      state.applyCalls.push({
        ...(typeof applyOptions.requiredRevisionId === "string"
          ? { requiredRevisionId: applyOptions.requiredRevisionId }
          : {}),
        patchIds: mutations.map((mutation) => mutation.patchId)
      });

      if (options?.forceRevisionMismatch) {
        throw new Error("revision mismatch");
      }
      if (options?.forceRevisionMismatchAtCall === state.applyCallCount) {
        throw new Error("revision mismatch");
      }

      const expectedRevision = `r${state.revisionCounter}`;
      if (applyOptions.requiredRevisionId && applyOptions.requiredRevisionId !== expectedRevision) {
        throw new Error("revision mismatch");
      }

      for (const mutation of mutations) {
        applyMutation(state.presentation, mutation);
      }

      state.revisionCounter += 1;
      if (options?.omitResultRevisionId) {
        return {};
      }
      return { revisionId: `r${state.revisionCounter}` };
    },
    getDocumentCarrier: async () => state.carrier,
    setDocumentCarrier: async (content: string) => {
      state.carrier = content;
    }
  };

  return {
    api,
    get carrier() {
      return state.carrier;
    },
    set carrier(content: string) {
      state.carrier = content;
    },
    getApplyCalls: () => [...state.applyCalls],
    mutateShape: (slideId, objectId, mutator) => {
      const shape = findShape(state.presentation, slideId, objectId);
      if (shape) {
        mutator(shape);
      }
    },
    removeShape: (slideId, objectId) => {
      const slide = state.presentation.slides.find((candidate) => candidate.slideId === slideId);
      if (!slide) {
        return;
      }
      slide.pageElements = slide.pageElements.filter((candidate) => candidate.objectId !== objectId);
    }
  };
}

function applyMutation(presentation: GoogleBridgePresentation, mutation: BridgeMutation): void {
  const shape = findShape(presentation, mutation.slideId, mutation.objectId);
  if (!shape) {
    return;
  }

  switch (mutation.op) {
    case "SET_FONT_FAMILY": {
      if (!shape.text?.runs) {
        return;
      }
      const fontFamily = typeof mutation.fields.fontFamily === "string" ? mutation.fields.fontFamily : undefined;
      if (!fontFamily) {
        return;
      }
      for (const run of shape.text.runs) {
        run.fontFamily = fontFamily;
      }
      return;
    }
    case "SET_FONT_COLOR": {
      if (!shape.text?.runs) {
        return;
      }
      const fontColor = typeof mutation.fields.fontColor === "string" ? mutation.fields.fontColor : undefined;
      if (!fontColor) {
        return;
      }
      for (const run of shape.text.runs) {
        run.fontColor = fontColor;
      }
      return;
    }
    case "SET_FONT_STYLE": {
      if (!shape.text?.runs) {
        return;
      }
      const bold = typeof mutation.fields.bold === "boolean" ? mutation.fields.bold : undefined;
      const italic = typeof mutation.fields.italic === "boolean" ? mutation.fields.italic : undefined;
      for (const run of shape.text.runs) {
        if (bold !== undefined) {
          run.bold = bold;
        }
        if (italic !== undefined) {
          run.italic = italic;
        }
      }
      return;
    }
    case "SET_BULLET_INDENT": {
      const paragraph = shape.text?.paragraphs?.[0];
      if (!paragraph) {
        return;
      }
      const indent =
        typeof mutation.fields.bulletIndent === "number"
          ? mutation.fields.bulletIndent
          : typeof mutation.fields.indent === "number"
            ? mutation.fields.indent
            : undefined;
      const hanging =
        typeof mutation.fields.bulletHanging === "number"
          ? mutation.fields.bulletHanging
          : typeof mutation.fields.hanging === "number"
            ? mutation.fields.hanging
            : undefined;
      if (indent !== undefined) {
        paragraph.bulletIndent = indent;
      }
      if (hanging !== undefined) {
        paragraph.bulletHanging = hanging;
      }
      return;
    }
    case "DELETE_GHOST_OBJECT": {
      const slide = presentation.slides.find((candidate) => candidate.slideId === mutation.slideId);
      if (!slide) {
        return;
      }
      slide.pageElements = slide.pageElements.filter((candidate) => candidate.objectId !== mutation.objectId);
      return;
    }
    default:
      return;
  }
}

function findShape(
  presentation: GoogleBridgePresentation,
  slideId: string,
  objectId: string
): GoogleBridgePresentation["slides"][number]["pageElements"][number] | undefined {
  const slide = presentation.slides.find((candidate) => candidate.slideId === slideId);
  return slide?.pageElements.find((candidate) => candidate.objectId === objectId);
}

function clone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}
