import type { DeckSnapshot, PatchOp, PatchRecord, ReconcileSignature } from "@magistrat/shared-types";
import { simDeckFixture } from "../fixtures/sim-deck.fixture.js";
import type {
  AdapterCapabilityRegistry,
  AdapterProvider,
  AdapterRuntimeStatus,
  HostCapabilities
} from "../adapter-types.js";

interface SimProviderOptions {
  getDocumentIdentifier: () => string;
  hostCapabilities: HostCapabilities;
  capabilityRegistry: AdapterCapabilityRegistry;
}

let inMemoryDeck: DeckSnapshot | undefined;

export function createSimProvider(options: SimProviderOptions): AdapterProvider {
  const runtimeStatus: AdapterRuntimeStatus = {
    mode: "SIM",
    hostCapabilities: options.hostCapabilities,
    capabilities: {
      readDeckSnapshot: { supported: true },
      applyPatchOps: { supported: true },
      selectObject: { supported: true }
    },
    capabilityRegistry: options.capabilityRegistry
  };

  return {
    getRuntimeStatus: () => runtimeStatus,
    readDeckSnapshot: async () => readDeckSnapshot(options.getDocumentIdentifier),
    applyPatchOps: async (patchOps) => applyPatchOps(patchOps, options.getDocumentIdentifier),
    selectObject: async (slideId, objectId) => selectObject(slideId, objectId, options.getDocumentIdentifier)
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

  return patchOps.map((patch) => {
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
}

async function selectObject(
  slideId: string,
  objectId: string,
  getDocumentIdentifier: () => string
): Promise<boolean> {
  const deck = ensureDeck(getDocumentIdentifier);
  const slide = deck.slides.find((candidate) => candidate.slideId === slideId);
  const shape = slide?.shapes.find((candidate) => candidate.objectId === objectId);
  return Boolean(shape);
}

function ensureDeck(getDocumentIdentifier: () => string): DeckSnapshot {
  if (!inMemoryDeck) {
    inMemoryDeck = clone(simDeckFixture);
  }

  inMemoryDeck.deckId = getDocumentIdentifier();
  return inMemoryDeck;
}

function applyPatchToShape(shape: DeckSnapshot["slides"][number]["shapes"][number], patch: PatchOp): {
  deleted: boolean;
} {
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
    case "SET_FONT_SIZE": {
      const fontSizePt = typeof patch.fields.fontSizePt === "number" ? patch.fields.fontSizePt : undefined;
      if (fontSizePt !== undefined) {
        for (const run of shape.textRuns) {
          run.fontSizePt = fontSizePt;
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
      const paragraph = shape.paragraphs[0] ?? {
        level: 0 as const,
        text: shape.textRuns.map((run) => run.text).join(" ")
      };
      if (shape.paragraphs.length === 0) {
        shape.paragraphs.push(paragraph);
      }
      if (bulletIndent !== undefined) {
        paragraph.bulletIndent = bulletIndent;
      }
      if (bulletHanging !== undefined) {
        paragraph.bulletHanging = bulletHanging;
      }
      return { deleted: false };
    }
    case "SET_LINE_SPACING": {
      const lineSpacing = typeof patch.fields.lineSpacing === "number" ? patch.fields.lineSpacing : undefined;
      const paragraph = shape.paragraphs[0];
      if (paragraph && lineSpacing !== undefined) {
        paragraph.lineSpacing = lineSpacing;
      }
      return { deleted: false };
    }
    case "NORMALIZE_LANGUAGE_TAGS": {
      const proofingLanguage =
        typeof patch.fields.proofingLanguage === "string" ? patch.fields.proofingLanguage : undefined;
      if (proofingLanguage) {
        for (const run of shape.textRuns) {
          run.proofingLanguage = proofingLanguage;
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

function buildReconcileSignatureFromShape(
  shape: DeckSnapshot["slides"][number]["shapes"][number] | undefined
): ReconcileSignature {
  if (!shape) {
    return emptySignature();
  }

  const run = shape.textRuns[0];

  return {
    fontFamily: run?.fontFamily ?? null,
    fontSizePt: run?.fontSizePt ?? null,
    fontColor: run?.fontColor ?? null,
    bold: run?.bold ?? null,
    italic: run?.italic ?? null,
    bulletIndent: shape.paragraphs[0]?.bulletIndent ?? null,
    bulletHanging: shape.paragraphs[0]?.bulletHanging ?? null
  };
}

function emptySignature(): ReconcileSignature {
  return {
    fontFamily: null,
    fontSizePt: null,
    fontColor: null,
    bold: null,
    italic: null,
    bulletIndent: null,
    bulletHanging: null
  };
}

function clone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

export function resetSimDeckForTests(): void {
  inMemoryDeck = undefined;
}
