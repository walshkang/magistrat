import type { DeckSnapshot, PatchOp, PatchRecord } from "@magistrat/shared-types";

export interface HostCapabilities {
  host: "powerpoint" | "unknown";
  platform: "pc" | "mac" | "web" | "unknown";
  officeAvailable: boolean;
  desktopSupported: boolean;
}

export type AdapterMode = "SIM" | "OFFICE_SHADOW" | "OFFICE_READONLY";

export type AdapterCapabilityReasonCode =
  | "OFFICE_UNAVAILABLE"
  | "HOST_UNSUPPORTED"
  | "PLATFORM_UNSUPPORTED"
  | "REQUIREMENT_SET_UNSUPPORTED"
  | "POLICY_DISABLED"
  | "API_LIMITATION";

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
  requirementSets: {
    powerPointApi_1_4: AdapterCapability;
    powerPointApi_1_6: AdapterCapability;
  };
  policies: {
    livePatchApply: AdapterCapability;
    bulletMetrics: AdapterCapability;
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
