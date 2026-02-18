import type { DeckSnapshot, PatchOp, PatchRecord } from "@magistrat/shared-types";
import type {
  AdapterCapability,
  AdapterCapabilityRegistry,
  AdapterProvider,
  AdapterRuntimeStatus,
  HostCapabilities
} from "../adapter-types.js";
import type { BridgeMutation, GoogleSlidesBridge } from "../bridge-types.js";
import { mapPresentationToDeckSnapshot } from "./google-mappers.js";
import { buildReconcileSignatureFromShape, emptySignature } from "./signatures.js";

interface GoogleSafeProviderOptions {
  bridge: GoogleSlidesBridge;
  hostCapabilities: HostCapabilities;
  capabilityRegistry: AdapterCapabilityRegistry;
  readDeckSnapshotCapability: AdapterCapability;
  applyPatchOpsCapability: AdapterCapability;
}

const GOOGLE_SAFE_CHUNK_SIZE = 75;

const SAFE_OPS = new Set<PatchOp["op"]>([
  "SET_FONT_FAMILY",
  "SET_FONT_COLOR",
  "SET_FONT_STYLE",
  "SET_BULLET_INDENT",
  "DELETE_GHOST_OBJECT"
]);

const SELECT_REASON = "Object selection is disabled in GOOGLE_SAFE mode for alpha.";

export function createGoogleSafeProvider(options: GoogleSafeProviderOptions): AdapterProvider {
  const runtimeStatus: AdapterRuntimeStatus = {
    mode: "GOOGLE_SAFE",
    hostCapabilities: options.hostCapabilities,
    capabilities: {
      readDeckSnapshot: options.readDeckSnapshotCapability,
      applyPatchOps: options.applyPatchOpsCapability,
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
    readDeckSnapshot: async () => readDeckSnapshot(options.bridge),
    applyPatchOps: async (patchOps) => applyPatchOps(options.bridge, patchOps),
    selectObject: async () => false
  };
}

async function readDeckSnapshot(bridge: GoogleSlidesBridge): Promise<DeckSnapshot> {
  const presentation = await bridge.readPresentation();
  return mapPresentationToDeckSnapshot(presentation);
}

async function applyPatchOps(bridge: GoogleSlidesBridge, patchOps: PatchOp[]): Promise<PatchRecord[]> {
  if (patchOps.length === 0) {
    return [];
  }

  if (typeof bridge.applyMutations !== "function") {
    throw new Error("applyPatchOps not supported: Bridge does not provide applyMutations.");
  }

  const presentationBefore = await bridge.readPresentation();
  const deckBefore = mapPresentationToDeckSnapshot(presentationBefore);
  const appliedAtIso = new Date().toISOString();

  const pendingMutations: BridgeMutation[] = [];
  const pendingPatchesById = new Map<string, PatchOp>();
  const records: PatchRecord[] = [];

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

    const mutation = toBridgeMutation(patch);
    pendingMutations.push(mutation);
    pendingPatchesById.set(patch.id, patch);
  }

  if (pendingMutations.length === 0) {
    return records;
  }

  let requiredRevisionId =
    typeof presentationBefore.revisionId === "string" ? presentationBefore.revisionId : undefined;
  const successfulMutations: BridgeMutation[] = [];
  const mutationChunks = chunkMutations(pendingMutations, GOOGLE_SAFE_CHUNK_SIZE);

  for (const [chunkIndex, chunk] of mutationChunks.entries()) {
    try {
      const mutationOptions = requiredRevisionId ? { requiredRevisionId } : {};
      const applyResult = await bridge.applyMutations(chunk, mutationOptions);
      successfulMutations.push(...chunk);
      requiredRevisionId = await resolveRequiredRevisionId(bridge, applyResult.revisionId, requiredRevisionId);
    } catch (error) {
      if (successfulMutations.length > 0) {
        try {
          const deckAfterPartial = mapPresentationToDeckSnapshot(await bridge.readPresentation());
          const partialAppliedRecords = buildPatchRecords(
            successfulMutations,
            pendingPatchesById,
            deckBefore,
            deckAfterPartial,
            appliedAtIso
          );
          throw createPartialApplyError(error, partialAppliedRecords);
        } catch (snapshotError) {
          if (snapshotError instanceof Error && "partialAppliedRecords" in snapshotError) {
            throw snapshotError;
          }
          throw createPartialApplyError(error);
        }
      }

      if (isRevisionMismatchError(error)) {
        throw new Error("Patch apply failed due to revision mismatch. Re-run clean up and retry.");
      }

      throw error;
    }

    if (chunkIndex < mutationChunks.length - 1) {
      await yieldToEventLoop();
    }
  }

  const deckAfter = mapPresentationToDeckSnapshot(await bridge.readPresentation());
  records.push(...buildPatchRecords(pendingMutations, pendingPatchesById, deckBefore, deckAfter, appliedAtIso));

  return records;
}

function buildPatchRecords(
  mutations: BridgeMutation[],
  patchesById: Map<string, PatchOp>,
  deckBefore: DeckSnapshot,
  deckAfter: DeckSnapshot,
  appliedAtIso: string
): PatchRecord[] {
  const records: PatchRecord[] = [];

  for (const mutation of mutations) {
    const patch = patchesById.get(mutation.patchId);
    if (!patch) {
      continue;
    }

    const beforeShape = findShape(deckBefore, patch.target.slideId, patch.target.objectId);
    const afterShape = findShape(deckAfter, patch.target.slideId, patch.target.objectId);

    records.push({
      id: patch.id,
      findingId: `finding-for-${patch.id}`,
      targetFingerprint: patch.target,
      before: buildReconcileSignatureFromShape(beforeShape),
      after:
        patch.op === "DELETE_GHOST_OBJECT" && !afterShape
          ? emptySignature()
          : buildReconcileSignatureFromShape(afterShape),
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

function chunkMutations(mutations: BridgeMutation[], chunkSize: number): BridgeMutation[][] {
  const chunks: BridgeMutation[][] = [];
  for (let index = 0; index < mutations.length; index += chunkSize) {
    chunks.push(mutations.slice(index, index + chunkSize));
  }
  return chunks;
}

async function resolveRequiredRevisionId(
  bridge: GoogleSlidesBridge,
  applyResultRevisionId: string | undefined,
  currentRevisionId: string | undefined
): Promise<string | undefined> {
  if (typeof applyResultRevisionId === "string") {
    return applyResultRevisionId;
  }

  const refreshedPresentation = await bridge.readPresentation();
  if (typeof refreshedPresentation.revisionId === "string") {
    return refreshedPresentation.revisionId;
  }

  return currentRevisionId;
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function createPartialApplyError(error: unknown, partialAppliedRecords?: PatchRecord[]): Error {
  const baseMessage = isRevisionMismatchError(error)
    ? "Patch apply failed due to revision mismatch."
    : `Patch apply failed: ${error instanceof Error ? error.message : "unknown error"}.`;
  const errorWithPartialRecords = new Error(
    partialAppliedRecords
      ? `${baseMessage} Some safe patches were applied before interruption. Re-run clean up and review patch log.`
      : baseMessage
  ) as Error & { partialAppliedRecords?: PatchRecord[]; cause?: unknown };

  if (partialAppliedRecords) {
    errorWithPartialRecords.partialAppliedRecords = partialAppliedRecords;
  }
  errorWithPartialRecords.cause = error;
  return errorWithPartialRecords;
}

function assertSafeOperation(patch: PatchOp): void {
  if (!SAFE_OPS.has(patch.op)) {
    throw new Error(
      `Patch op ${patch.op} is not apply-eligible in Google alpha. Only safe operations are supported.`
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

function toBridgeMutation(patch: PatchOp): BridgeMutation {
  if (patch.op === "SET_BULLET_INDENT") {
    const normalizedFields: BridgeMutation["fields"] = {
      ...(typeof patch.fields.bulletIndent === "number" ? { bulletIndent: patch.fields.bulletIndent } : {}),
      ...(typeof patch.fields.indent === "number" ? { bulletIndent: patch.fields.indent } : {}),
      ...(typeof patch.fields.bulletHanging === "number" ? { bulletHanging: patch.fields.bulletHanging } : {}),
      ...(typeof patch.fields.hanging === "number" ? { bulletHanging: patch.fields.hanging } : {})
    };

    return {
      patchId: patch.id,
      op: patch.op,
      slideId: patch.target.slideId,
      objectId: patch.target.objectId,
      fields: normalizedFields
    };
  }

  return {
    patchId: patch.id,
    op: patch.op,
    slideId: patch.target.slideId,
    objectId: patch.target.objectId,
    fields: patch.fields
  };
}

function findShape(
  deck: DeckSnapshot,
  slideId: string,
  objectId: string
): DeckSnapshot["slides"][number]["shapes"][number] | undefined {
  const slide = deck.slides.find((candidate) => candidate.slideId === slideId);
  return slide?.shapes.find((candidate) => candidate.objectId === objectId);
}

function isRevisionMismatchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("revision") && message.includes("mismatch");
}
