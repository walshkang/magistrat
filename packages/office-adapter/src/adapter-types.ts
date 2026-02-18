import type { DeckSnapshot, PatchOp, PatchRecord } from "@magistrat/shared-types";

export interface HostCapabilities {
  host: "powerpoint" | "unknown";
  platform: "pc" | "mac" | "web" | "unknown";
  officeAvailable: boolean;
  desktopSupported: boolean;
}

export type AdapterMode = "SIM" | "OFFICE_SHADOW";

export interface AdapterCapability {
  supported: boolean;
  reason?: string;
}

export interface AdapterCapabilities {
  readDeckSnapshot: AdapterCapability;
  applyPatchOps: AdapterCapability;
  selectObject: AdapterCapability;
}

export interface AdapterRuntimeStatus {
  mode: AdapterMode;
  hostCapabilities: HostCapabilities;
  capabilities: AdapterCapabilities;
}

export interface AdapterProvider {
  getRuntimeStatus(): AdapterRuntimeStatus;
  readDeckSnapshot(): Promise<DeckSnapshot>;
  applyPatchOps(patchOps: PatchOp[]): Promise<PatchRecord[]>;
  selectObject(slideId: string, objectId: string): Promise<boolean>;
}
