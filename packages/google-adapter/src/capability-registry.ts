import type { AdapterCapability, AdapterCapabilityRegistry, HostCapabilities } from "./adapter-types.js";
import type { GoogleSlidesBridge } from "./bridge-types.js";

export function buildCapabilityRegistry(
  hostCapabilities: HostCapabilities,
  bridge: GoogleSlidesBridge | undefined
): AdapterCapabilityRegistry {
  const bridgeCapabilities = bridge?.getCapabilities?.();

  return {
    features: {
      slidesRead: resolveBridgeFeature(hostCapabilities, bridge, bridgeCapabilities?.readDeckSnapshot, "read deck snapshot"),
      slidesWrite: resolveBridgeFeature(hostCapabilities, bridge, bridgeCapabilities?.applyPatchOps, "apply patch ops"),
      documentStateCarrier: resolveBridgeFeature(
        hostCapabilities,
        bridge,
        bridgeCapabilities?.documentStateCarrier,
        "document state carrier"
      )
    },
    policies: {
      safeOpsOnly: {
        supported: true,
        reason: "Google v1 policy restricts apply to safe operations."
      },
      reconcileFidelityGate: {
        supported: true,
        reason: "Apply is blocked when required readback signatures are unavailable."
      },
      selectObject: {
        supported: false,
        reasonCode: "POLICY_DISABLED",
        reason: "Object selection remains disabled in Google v1 policy."
      }
    }
  };
}

function resolveBridgeFeature(
  hostCapabilities: HostCapabilities,
  bridge: GoogleSlidesBridge | undefined,
  explicitSupport: boolean | undefined,
  featureName: string
): AdapterCapability {
  if (!hostCapabilities.bridgeAvailable || !bridge) {
    return {
      supported: false,
      reasonCode: "GOOGLE_UNAVAILABLE",
      reason: `Google bridge is unavailable for ${featureName}.`
    };
  }

  if (hostCapabilities.host !== "google_slides") {
    return {
      supported: false,
      reasonCode: "HOST_UNSUPPORTED",
      reason: "Only Google Slides host is supported by this adapter."
    };
  }

  if (explicitSupport === false) {
    return {
      supported: false,
      reasonCode: "API_LIMITATION",
      reason: `Bridge reports ${featureName} unsupported.`
    };
  }

  return { supported: true };
}
