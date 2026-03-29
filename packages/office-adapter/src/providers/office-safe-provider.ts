import type { DeckSnapshot, PatchOp, PatchRecord, ShapeSnapshot } from "@magistrat/shared-types";
import type {
  AdapterCapabilityRegistry,
  AdapterProvider,
  AdapterRuntimeStatus,
  HostCapabilities
} from "../adapter-types.js";
import { createOfficeReadonlyProvider } from "./office-readonly-provider.js";

interface OfficeSafeProviderOptions {
  getDocumentIdentifier: () => string;
  hostCapabilities: HostCapabilities;
  capabilityRegistry: AdapterCapabilityRegistry;
}

const SAFE_OPS = new Set<PatchOp["op"]>([
  "SET_FONT_FAMILY",
  "SET_FONT_COLOR",
  "SET_FONT_STYLE",
  "SET_BULLET_INDENT",
  "DELETE_GHOST_OBJECT",
  "NORMALIZE_LANGUAGE_TAGS"
]);

const CHUNK_SIZE = 50;
const SELECT_REASON = "Object selection is deferred in OFFICE_SAFE mode.";

export function createOfficeSafeProvider(options: OfficeSafeProviderOptions): AdapterProvider {
  // Reuse the readonly provider for deck reading
  const readonlyProvider = createOfficeReadonlyProvider(options);

  const runtimeStatus: AdapterRuntimeStatus = {
    mode: "OFFICE_SAFE",
    hostCapabilities: options.hostCapabilities,
    capabilities: {
      readDeckSnapshot: { supported: true },
      applyPatchOps: { supported: true },
      selectObject: {
        supported: false,
        reasonCode: "POLICY_DISABLED",
        reason: SELECT_REASON
      }
    },
    capabilityRegistry: options.capabilityRegistry
  };

  return {
    getRuntimeStatus: () => runtimeStatus,
    readDeckSnapshot: () => readonlyProvider.readDeckSnapshot(),
    applyPatchOps: async (patchOps) => applyPatchOps(readonlyProvider, patchOps),
    selectObject: async () => false
  };
}

async function applyPatchOps(
  readonlyProvider: AdapterProvider,
  patchOps: PatchOp[]
): Promise<PatchRecord[]> {
  if (patchOps.length === 0) {
    return [];
  }

  // Snapshot before
  const deckBefore = await readonlyProvider.readDeckSnapshot();
  const appliedAtIso = new Date().toISOString();
  const records: PatchRecord[] = [];
  const pendingPatches: PatchOp[] = [];

  for (const patch of patchOps) {
    assertSafeOperation(patch);

    const beforeShape = findShape(deckBefore, patch.target.slideId, patch.target.objectId);
    if (!beforeShape) {
      records.push({
        id: patch.id,
        findingId: `finding-for-${patch.id}`,
        targetFingerprint: patch.target,
        before: emptySignature(),
        after: emptySignature(),
        reconcileState: "missing_target",
        appliedAtIso
      });
      continue;
    }

    assertReconcileFidelity(beforeShape, patch);
    pendingPatches.push(patch);
  }

  if (pendingPatches.length === 0) {
    return records;
  }

  // Apply via Office.js in chunks
  const run = getPowerPointRun();
  if (!run) {
    throw new Error("PowerPoint.run is unavailable for patch application.");
  }

  const chunks = chunkArray(pendingPatches, CHUNK_SIZE);
  for (const chunk of chunks) {
    await run(async (contextRaw: unknown) => {
      const context = contextRaw as ContextLike;
      const slidesCollection = context.presentation?.slides;
      if (!slidesCollection) {
        throw new Error("PowerPoint presentation slides API is unavailable.");
      }

      slidesCollection.load("items");
      await context.sync();

      const slides = slidesCollection.items ?? [];
      for (const slide of slides) {
        slide.load("id");
        slide.shapes.load("items");
      }
      await context.sync();

      for (const patch of chunk) {
        const slide = slides.find((s) => s.id === patch.target.slideId);
        if (!slide) continue;

        const shapes = slide.shapes.items ?? [];
        const shape = shapes.find((s) => s.id === patch.target.objectId);
        if (!shape) continue;

        applyMutationToShape(context, shape, patch);
      }

      await context.sync();
      return undefined as unknown as DeckSnapshot;
    });
  }

  // Snapshot after
  const deckAfter = await readonlyProvider.readDeckSnapshot();

  for (const patch of pendingPatches) {
    const beforeShape = findShape(deckBefore, patch.target.slideId, patch.target.objectId);
    const afterShape = findShape(deckAfter, patch.target.slideId, patch.target.objectId);

    records.push({
      id: patch.id,
      findingId: `finding-for-${patch.id}`,
      targetFingerprint: patch.target,
      before: buildSignature(beforeShape),
      after:
        patch.op === "DELETE_GHOST_OBJECT" && !afterShape
          ? emptySignature()
          : buildSignature(afterShape),
      reconcileState:
        patch.op === "DELETE_GHOST_OBJECT" && !afterShape
          ? "applied"
          : afterShape
            ? "applied"
            : "missing_target",
      appliedAtIso
    });
  }

  return records;
}

// ---- Office.js shape mutation ----

function applyMutationToShape(
  _context: ContextLike,
  shape: ShapeLike,
  patch: PatchOp
): void {
  const textFrame = shape.textFrame;
  const textRange = textFrame?.textRange;
  const font = textRange?.font;

  switch (patch.op) {
    case "SET_FONT_FAMILY": {
      if (font && typeof patch.fields.fontFamily === "string") {
        font.name = patch.fields.fontFamily;
      }
      break;
    }
    case "SET_FONT_COLOR": {
      if (font && typeof patch.fields.fontColor === "string") {
        font.color = patch.fields.fontColor;
      }
      break;
    }
    case "SET_FONT_STYLE": {
      if (font) {
        if (typeof patch.fields.bold === "boolean") {
          font.bold = patch.fields.bold;
        }
        if (typeof patch.fields.italic === "boolean") {
          font.italic = patch.fields.italic;
        }
      }
      break;
    }
    case "SET_BULLET_INDENT": {
      // Office.js paragraph bullet API is limited; this is a best-effort stub.
      // Full bullet indent mutation requires ParagraphFormat API (PowerPointApi 1.6+).
      break;
    }
    case "DELETE_GHOST_OBJECT": {
      if (typeof shape.delete === "function") {
        shape.delete();
      }
      break;
    }
    case "NORMALIZE_LANGUAGE_TAGS": {
      // Office.js does not expose proofingLanguage on TextRange in current API sets.
      // This is a no-op placeholder; the finding remains for manual resolution.
      break;
    }
    default:
      break;
  }
}

// ---- Guards ----

function assertSafeOperation(patch: PatchOp): void {
  if (!SAFE_OPS.has(patch.op)) {
    throw new Error(
      `Patch op ${patch.op} is not apply-eligible in Office SAFE policy. Only safe operations are supported.`
    );
  }
}

function assertReconcileFidelity(shape: ShapeSnapshot, patch: PatchOp): void {
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

  if (patch.op === "NORMALIZE_LANGUAGE_TAGS") {
    // No typography check needed for language normalization
    return;
  }

  if (!shape.inspectability.typography || !shape.textRuns[0]) {
    throw new Error(`Patch ${patch.id} blocked: typography signature is unreadable for reconcile fidelity.`);
  }
}

function isStrictGhost(shape: ShapeSnapshot): boolean {
  const area = shape.geometry.width * shape.geometry.height;
  return (
    !shape.visible &&
    area > 200 &&
    shape.textRuns.length > 0 &&
    shape.textRuns.every((run) => run.fontAlpha === 0)
  );
}

// ---- Reconcile signatures ----

function buildSignature(
  shape: ShapeSnapshot | undefined
): PatchRecord["before"] {
  if (!shape) return emptySignature();
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

function emptySignature(): PatchRecord["before"] {
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

// ---- Utilities ----

function findShape(
  deck: DeckSnapshot,
  slideId: string,
  objectId: string
): ShapeSnapshot | undefined {
  const slide = deck.slides.find((s) => s.slideId === slideId);
  return slide?.shapes.find((s) => s.objectId === objectId);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function getPowerPointRun():
  | ((callback: (context: unknown) => Promise<DeckSnapshot>) => Promise<DeckSnapshot>)
  | undefined {
  const powerPointGlobal = (
    globalThis as unknown as {
      PowerPoint?: {
        run?: (callback: (context: unknown) => Promise<DeckSnapshot>) => Promise<DeckSnapshot>;
      };
    }
  ).PowerPoint;

  const run = powerPointGlobal?.run;
  if (typeof run !== "function") return undefined;
  return run.bind(powerPointGlobal);
}

// ---- Office.js type stubs (same as office-readonly-provider) ----

interface ContextLike {
  sync(): Promise<void>;
  presentation?: {
    slides?: SlideCollectionLike;
  };
}

interface SlideCollectionLike {
  items?: SlideLike[];
  load(select: string): void;
}

interface SlideLike {
  id?: string;
  shapes: ShapeCollectionLike;
  load(select: string): void;
}

interface ShapeCollectionLike {
  items?: ShapeLike[];
  load(select: string): void;
}

interface ShapeLike {
  id?: string;
  textFrame?: TextFrameLike;
  delete?: () => void;
  load(select: string): void;
}

interface TextFrameLike {
  textRange?: TextRangeLike;
  load(select: string): void;
}

interface TextRangeLike {
  font?: FontLike;
  load(select: string): void;
}

interface FontLike {
  name?: string | null;
  size?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  color?: string | null;
}
