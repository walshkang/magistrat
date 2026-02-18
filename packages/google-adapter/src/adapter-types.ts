import type { DeckSnapshot, PatchOp, PatchRecord } from "@magistrat/shared-types";

export interface HostCapabilities {
  host: "google_slides" | "unknown";
  platform: "web" | "unknown";
  bridgeAvailable: boolean;
  addOnContextAvailable: boolean;
}

export type AdapterMode = "SIM" | "GOOGLE_SHADOW" | "GOOGLE_READONLY" | "GOOGLE_SAFE";

export type AdapterCapabilityReasonCode =
  | "GOOGLE_UNAVAILABLE"
  | "HOST_UNSUPPORTED"
  | "POLICY_DISABLED"
  | "API_LIMITATION"
  | "REVISION_MISMATCH";

export interface AdapterCapability {
  supported: boolean;
  reasonCode?: AdapterCapabilityReasonCode;
  reason?: string;
}

export interface AdapterCapabilities {
  readDeckSnapshot: AdapterCapability;
  applyPatchOps: AdapterCapability;
  selectObject: AdapterCapability;
}

export interface AdapterCapabilityRegistry {
  features: {
    slidesRead: AdapterCapability;
    slidesWrite: AdapterCapability;
    documentStateCarrier: AdapterCapability;
  };
  policies: {
    safeOpsOnly: AdapterCapability;
    reconcileFidelityGate: AdapterCapability;
    selectObject: AdapterCapability;
  };
}

export interface AdapterRuntimeStatus {
  mode: AdapterMode;
  hostCapabilities: HostCapabilities;
  capabilities: AdapterCapabilities;
  capabilityRegistry: AdapterCapabilityRegistry;
}

export interface AdapterProvider {
  getRuntimeStatus(): AdapterRuntimeStatus;
  readDeckSnapshot(): Promise<DeckSnapshot>;
  applyPatchOps(patchOps: PatchOp[]): Promise<PatchRecord[]>;
  selectObject(slideId: string, objectId: string): Promise<boolean>;
}
