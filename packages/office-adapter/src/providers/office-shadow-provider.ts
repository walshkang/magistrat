import type { PatchOp } from "@magistrat/shared-types";
import type {
  AdapterCapabilities,
  AdapterCapability,
  AdapterCapabilityRegistry,
  AdapterProvider,
  AdapterRuntimeStatus,
  HostCapabilities
} from "../adapter-types.js";

interface OfficeShadowProviderOptions {
  hostCapabilities: HostCapabilities;
  capabilityRegistry: AdapterCapabilityRegistry;
  readDeckSnapshotCapability?: AdapterCapability;
}

const READ_REASON = "Deck snapshot is unavailable in OFFICE_SHADOW mode.";
const APPLY_REASON = "Patch application is disabled in OFFICE_SHADOW mode until live host mutations are validated.";
const SELECT_REASON = "Object selection is disabled in OFFICE_SHADOW mode for now.";

export function createOfficeShadowProvider(options: OfficeShadowProviderOptions): AdapterProvider {
  const capabilities: AdapterCapabilities = {
    readDeckSnapshot: options.readDeckSnapshotCapability ?? {
      supported: false,
      reasonCode: "API_LIMITATION",
      reason: READ_REASON
    },
    applyPatchOps: {
      supported: false,
      reasonCode: "POLICY_DISABLED",
      reason: APPLY_REASON
    },
    selectObject: {
      supported: false,
      reasonCode: "POLICY_DISABLED",
      reason: SELECT_REASON
    }
  };

  const runtimeStatus: AdapterRuntimeStatus = {
    mode: "OFFICE_SHADOW",
    hostCapabilities: options.hostCapabilities,
    capabilities,
    capabilityRegistry: options.capabilityRegistry
  };

  return {
    getRuntimeStatus: () => runtimeStatus,
    readDeckSnapshot: async () => notSupported("readDeckSnapshot", capabilities.readDeckSnapshot.reason ?? READ_REASON),
    applyPatchOps: async (_patchOps: PatchOp[]) => {
      return notSupported("applyPatchOps", capabilities.applyPatchOps.reason ?? APPLY_REASON);
    },
    selectObject: async (_slideId: string, _objectId: string) => {
      return notSupported("selectObject", capabilities.selectObject.reason ?? SELECT_REASON);
    }
  };
}

function notSupported<T>(action: string, reason: string): Promise<T> {
  return Promise.reject(new Error(`${action} not supported: ${reason}`));
}
