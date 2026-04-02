import type { DeckSnapshot, DocumentStateV1, PatchOp, PatchRecord } from "@magistrat/shared-types";
import type { AdapterRuntimeStatus, HostCapabilities } from "./adapter-types.js";
import {
  createDefaultDocumentState,
  getDocumentIdentifier,
  loadDocumentState as loadDocumentStateInternal,
  saveDocumentState as saveDocumentStateInternal
} from "./document-state.js";
import {
  getAdapterProvider,
  getHostCapabilities as detectHostCapabilities,
  resetAdapterProviderForTests
} from "./provider-factory.js";
import { getGoogleSlidesBridge, setGoogleSlidesBridgeForTests } from "./bridge-types.js";
import type { GoogleBridgeMasterLayouts, GoogleBridgeMasterPatchResult } from "./bridge-types.js";
import { stableTargetFingerprint } from "./target-fingerprint.js";

export async function readDeckSnapshot(): Promise<DeckSnapshot> {
  const provider = getAdapterProvider();
  const status = provider.getRuntimeStatus();
  if (!status.capabilities.readDeckSnapshot.supported) {
    throw new Error(status.capabilities.readDeckSnapshot.reason ?? "readDeckSnapshot is not supported");
  }
  return provider.readDeckSnapshot();
}

export async function applyPatchOps(patchOps: PatchOp[]): Promise<PatchRecord[]> {
  const provider = getAdapterProvider();
  const status = provider.getRuntimeStatus();
  if (!status.capabilities.applyPatchOps.supported) {
    throw new Error(status.capabilities.applyPatchOps.reason ?? "applyPatchOps is not supported");
  }
  return provider.applyPatchOps(patchOps);
}

export async function readMasterLayouts(): Promise<GoogleBridgeMasterLayouts> {
  const bridge = getGoogleSlidesBridge();
  if (!bridge?.readMasterLayouts) {
    throw new Error("readMasterLayouts is not available on the current bridge");
  }
  return bridge.readMasterLayouts();
}

export async function applyMasterPatches(requests: unknown[]): Promise<GoogleBridgeMasterPatchResult> {
  const bridge = getGoogleSlidesBridge();
  if (!bridge?.applyMasterPatches) {
    throw new Error("applyMasterPatches is not available on the current bridge");
  }
  return bridge.applyMasterPatches(requests);
}

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

export async function selectObject(slideId: string, objectId: string): Promise<boolean> {
  const provider = getAdapterProvider();
  const status = provider.getRuntimeStatus();
  if (!status.capabilities.selectObject.supported) {
    return false;
  }
  return provider.selectObject(slideId, objectId);
}

export async function loadDocumentState(): Promise<DocumentStateV1> {
  return loadDocumentStateInternal(createDefaultDocumentState());
}

export async function saveDocumentState(nextState: DocumentStateV1): Promise<void> {
  await saveDocumentStateInternal(nextState);
}

export function getHostCapabilities(): HostCapabilities {
  return detectHostCapabilities();
}

export function getRuntimeStatus(): AdapterRuntimeStatus {
  return getAdapterProvider().getRuntimeStatus();
}

export function getDocumentId(): string {
  return getDocumentIdentifier();
}

export {
  createDefaultDocumentState as createInitialDocumentState,
  resetAdapterProviderForTests,
  stableTargetFingerprint
};

export type {
  AdapterCapabilities,
  AdapterCapability,
  AdapterCapabilityReasonCode,
  AdapterCapabilityRegistry,
  AdapterMode,
  AdapterRuntimeStatus,
  HostCapabilities
} from "./adapter-types.js";

export { setGoogleSlidesBridgeForTests };

export type { GoogleBridgeMasterLayouts, GoogleBridgeMasterPatchResult };

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
