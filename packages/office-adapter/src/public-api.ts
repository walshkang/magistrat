import type { DeckSnapshot, DocumentStateV1, PatchOp, PatchRecord } from "@magistrat/shared-types";
import type { AdapterRuntimeStatus, HostCapabilities } from "./adapter-types.js";
import {
  createDefaultDocumentState,
  loadDocumentState as loadDocumentStateInternal,
  saveDocumentState as saveDocumentStateInternal
} from "./document-state.js";
import { getAdapterProvider, getHostCapabilities as detectHostCapabilities, resetAdapterProviderForTests } from "./provider-factory.js";
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
