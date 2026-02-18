import type { PatchOp } from "@magistrat/shared-types";
import type { AdapterProvider, AdapterRuntimeStatus, HostCapabilities } from "../adapter-types.js";

interface OfficeShadowProviderOptions {
  hostCapabilities: HostCapabilities;
}

const READ_REASON = "Office shadow mode is diagnostic-only in this bootstrap cycle.";
const APPLY_REASON = "Patch application is disabled in OFFICE_SHADOW mode until live host mutations are validated.";
const SELECT_REASON = "Object selection is disabled in OFFICE_SHADOW mode for now.";

export function createOfficeShadowProvider(options: OfficeShadowProviderOptions): AdapterProvider {
  const runtimeStatus: AdapterRuntimeStatus = {
    mode: "OFFICE_SHADOW",
    hostCapabilities: options.hostCapabilities,
    capabilities: {
      readDeckSnapshot: {
        supported: false,
        reason: READ_REASON
      },
      applyPatchOps: {
        supported: false,
        reason: APPLY_REASON
      },
      selectObject: {
        supported: false,
        reason: SELECT_REASON
      }
    }
  };

  return {
    getRuntimeStatus: () => runtimeStatus,
    readDeckSnapshot: async () => notSupported("readDeckSnapshot", READ_REASON),
    applyPatchOps: async (_patchOps: PatchOp[]) => {
      return notSupported("applyPatchOps", APPLY_REASON);
    },
    selectObject: async (_slideId: string, _objectId: string) => {
      return notSupported("selectObject", SELECT_REASON);
    }
  };
}

function notSupported<T>(action: string, reason: string): Promise<T> {
  return Promise.reject(new Error(`${action} not supported: ${reason}`));
}
