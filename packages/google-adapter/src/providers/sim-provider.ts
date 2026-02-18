import type { DeckSnapshot, PatchOp, PatchRecord } from "@magistrat/shared-types";
import { simDeckFixture } from "../fixtures/sim-deck.fixture.js";
import type {
  AdapterCapabilityRegistry,
  AdapterProvider,
  AdapterRuntimeStatus,
  HostCapabilities
} from "../adapter-types.js";
import { buildReconcileSignatureFromShape, emptySignature } from "./signatures.js";

interface SimProviderOptions {
  getDocumentIdentifier: () => string;
  hostCapabilities: HostCapabilities;
  capabilityRegistry: AdapterCapabilityRegistry;
}

let inMemoryDeck: DeckSnapshot | undefined;
let revisionCounter = 1;

const SAFE_OPS = new Set<PatchOp["op"]>([
  "SET_FONT_FAMILY",
  "SET_FONT_COLOR",
  "SET_FONT_STYLE",
  "SET_BULLET_INDENT",
  "DELETE_GHOST_OBJECT"
]);

export function createSimProvider(options: SimProviderOptions): AdapterProvider {
  const runtimeStatus: AdapterRuntimeStatus = {
    mode: "SIM",
    hostCapabilities: options.hostCapabilities,
    capabilities: {
      readDeckSnapshot: { supported: true },
      applyPatchOps: { supported: true },
      selectObject: { supported: false, reasonCode: "POLICY_DISABLED", reason: "Object selection is disabled in Google SIM mode." }
    },
    capabilityRegistry: options.capabilityRegistry
  };

  return {
    getRuntimeStatus: () => runtimeStatus,
    readDeckSnapshot: async () => readDeckSnapshot(options.getDocumentIdentifier),
    applyPatchOps: async (patchOps) => applyPatchOps(patchOps, options.getDocumentIdentifier),
    selectObject: async () => false
  };
}

async function readDeckSnapshot(getDocumentIdentifier: () => string): Promise<DeckSnapshot> {
  const deck = ensureDeck(getDocumentIdentifier);
  deck.generatedAtIso = new Date().toISOString();
  return clone(deck);
}

async function applyPatchOps(
  patchOps: PatchOp[],
  getDocumentIdentifier: () => string
): Promise<PatchRecord[]> {
  const deck = ensureDeck(getDocumentIdentifier);
  const appliedAtIso = new Date().toISOString();

  const results = patchOps.map((patch) => {
    assertSafeOperation(patch);

    const slide = deck.slides.find((candidate) => candidate.slideId === patch.target.slideId);
    const shapeIndex = slide?.shapes.findIndex((candidate) => candidate.objectId === patch.target.objectId) ?? -1;
    const shape = shapeIndex >= 0 && slide ? slide.shapes[shapeIndex] : undefined;

    if (!slide || !shape) {
      return {
        id: patch.id,
        findingId: `finding-for-${patch.id}`,
        targetFingerprint: patch.target,
        before: emptySignature(),
        after: emptySignature(),
        reconcileState: "missing_target",
        appliedAtIso
      } satisfies PatchRecord;
    }

    assertReconcileFidelity(shape, patch);

    const before = buildReconcileSignatureFromShape(shape);
    const mutation = applyPatchToShape(shape, patch);

    if (mutation.deleted) {
      slide.shapes.splice(shapeIndex, 1);
    }

    const after = mutation.deleted ? emptySignature() : buildReconcileSignatureFromShape(shape);

    return {
      id: patch.id,
      findingId: `finding-for-${patch.id}`,
      targetFingerprint: patch.target,
      before,
      after,
      reconcileState: "applied",
      appliedAtIso
    } satisfies PatchRecord;
  });

  if (results.some((record) => record.reconcileState === "applied")) {
    revisionCounter += 1;
  }

  return results;
}

function assertSafeOperation(patch: PatchOp): void {
  if (!SAFE_OPS.has(patch.op)) {
    throw new Error(
      `Patch op ${patch.op} is not apply-eligible in Google v1 policy. Only safe operations are supported.`
    );
  }
}

function assertReconcileFidelity(shape: DeckSnapshot["slides"][number]["shapes"][number], patch: PatchOp): void {
  if (patch.op === "SET_BULLET_INDENT") {
    if (!shape.inspectability.bullets || !shape.paragraphs[0]) {
      throw new Error(`Patch ${patch.id} blocked: bullet metrics are unreadable for reconcile fidelity.`);
    }
    return;
  }

  if (patch.op === "DELETE_GHOST_OBJECT") {
    if (!isStrictGhost(shape)) {
      throw new Error(`Patch ${patch.id} blocked: target did not meet strict ghost detection criteria.`);
    }
    return;
  }

  if (!shape.inspectability.typography || !shape.textRuns[0]) {
    throw new Error(`Patch ${patch.id} blocked: typography signature is unreadable for reconcile fidelity.`);
  }
}

function isStrictGhost(shape: DeckSnapshot["slides"][number]["shapes"][number]): boolean {
  const area = shape.geometry.width * shape.geometry.height;
  return (
    !shape.visible &&
    area > 200 &&
    shape.textRuns.length > 0 &&
    shape.textRuns.every((run) => run.fontAlpha === 0)
  );
}

function applyPatchToShape(
  shape: DeckSnapshot["slides"][number]["shapes"][number],
  patch: PatchOp
): { deleted: boolean } {
  switch (patch.op) {
    case "SET_FONT_FAMILY": {
      const fontFamily = typeof patch.fields.fontFamily === "string" ? patch.fields.fontFamily : undefined;
      if (fontFamily) {
        for (const run of shape.textRuns) {
          run.fontFamily = fontFamily;
        }
      }
      return { deleted: false };
    }
    case "SET_FONT_COLOR": {
      const fontColor = typeof patch.fields.fontColor === "string" ? patch.fields.fontColor : undefined;
      if (fontColor) {
        for (const run of shape.textRuns) {
          run.fontColor = fontColor;
        }
      }
      return { deleted: false };
    }
    case "SET_FONT_STYLE": {
      const bold = typeof patch.fields.bold === "boolean" ? patch.fields.bold : undefined;
      const italic = typeof patch.fields.italic === "boolean" ? patch.fields.italic : undefined;
      for (const run of shape.textRuns) {
        if (bold !== undefined) {
          run.bold = bold;
        }
        if (italic !== undefined) {
          run.italic = italic;
        }
      }
      return { deleted: false };
    }
    case "SET_BULLET_INDENT": {
      const bulletIndent =
        typeof patch.fields.bulletIndent === "number"
          ? patch.fields.bulletIndent
          : typeof patch.fields.indent === "number"
            ? patch.fields.indent
            : undefined;
      const bulletHanging =
        typeof patch.fields.bulletHanging === "number"
          ? patch.fields.bulletHanging
          : typeof patch.fields.hanging === "number"
            ? patch.fields.hanging
            : undefined;

      const paragraph = shape.paragraphs[0];
      if (paragraph) {
        if (bulletIndent !== undefined) {
          paragraph.bulletIndent = bulletIndent;
        }
        if (bulletHanging !== undefined) {
          paragraph.bulletHanging = bulletHanging;
        }
      }
      return { deleted: false };
    }
    case "DELETE_GHOST_OBJECT": {
      return { deleted: true };
    }
    default:
      return { deleted: false };
  }
}

function ensureDeck(getDocumentIdentifier: () => string): DeckSnapshot {
  if (!inMemoryDeck) {
    inMemoryDeck = clone(simDeckFixture);
  }

  inMemoryDeck.deckId = getDocumentIdentifier();
  return inMemoryDeck;
}

function clone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

export function resetSimDeckForTests(): void {
  inMemoryDeck = undefined;
  revisionCounter = 1;
}

export function getSimRevisionForTests(): string {
  return `sim-r${revisionCounter}`;
}
