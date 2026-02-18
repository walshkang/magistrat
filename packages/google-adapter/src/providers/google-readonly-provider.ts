import type { DeckSnapshot, PatchOp } from "@magistrat/shared-types";
import type {
  AdapterCapabilityRegistry,
  AdapterProvider,
  AdapterRuntimeStatus,
  HostCapabilities
} from "../adapter-types.js";
import type { GoogleSlidesBridge } from "../bridge-types.js";
import { mapPresentationToDeckSnapshot } from "./google-mappers.js";

interface GoogleReadonlyProviderOptions {
  bridge: GoogleSlidesBridge;
  hostCapabilities: HostCapabilities;
  capabilityRegistry: AdapterCapabilityRegistry;
  readDeckSnapshotCapability: {
    supported: boolean;
    reasonCode?: "GOOGLE_UNAVAILABLE" | "HOST_UNSUPPORTED" | "POLICY_DISABLED" | "API_LIMITATION" | "REVISION_MISMATCH";
    reason?: string;
  };
}

const APPLY_REASON = "Patch application is disabled in GOOGLE_READONLY mode.";
const SELECT_REASON = "Object selection is disabled in GOOGLE_READONLY mode for alpha.";

export function createGoogleReadonlyProvider(options: GoogleReadonlyProviderOptions): AdapterProvider {
  const runtimeStatus: AdapterRuntimeStatus = {
    mode: "GOOGLE_READONLY",
    hostCapabilities: options.hostCapabilities,
    capabilities: {
      readDeckSnapshot: options.readDeckSnapshotCapability,
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
    },
    capabilityRegistry: options.capabilityRegistry
  };

  return {
    getRuntimeStatus: () => runtimeStatus,
    readDeckSnapshot: async () => readDeckSnapshot(options.bridge),
    applyPatchOps: async (_patchOps: PatchOp[]) => notSupported("applyPatchOps", APPLY_REASON),
    selectObject: async (_slideId: string, _objectId: string) => notSupported("selectObject", SELECT_REASON)
  };
}

async function readDeckSnapshot(bridge: GoogleSlidesBridge): Promise<DeckSnapshot> {
  const presentation = await bridge.readPresentation();
  return mapPresentationToDeckSnapshot(presentation);
}

function notSupported<T>(action: string, reason: string): Promise<T> {
  return Promise.reject(new Error(`${action} not supported: ${reason}`));
}
