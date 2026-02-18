import type { AdapterCapability, AdapterProvider, HostCapabilities } from "./adapter-types.js";
import { buildCapabilityRegistry } from "./capability-registry.js";
import { getGoogleSlidesBridge } from "./bridge-types.js";
import { getDocumentIdentifier } from "./document-state.js";
import { createGoogleReadonlyProvider } from "./providers/google-readonly-provider.js";
import { createGoogleSafeProvider } from "./providers/google-safe-provider.js";
import { createGoogleShadowProvider } from "./providers/google-shadow-provider.js";
import { createSimProvider, resetSimDeckForTests } from "./providers/sim-provider.js";

let cachedProvider: AdapterProvider | undefined;

export function getHostCapabilities(): HostCapabilities {
  const bridge = getGoogleSlidesBridge();
  const hostInfo = bridge?.getHostInfo?.();
  const host = hostInfo?.host === "google_slides" ? "google_slides" : "unknown";
  const platform = hostInfo?.platform === "web" ? "web" : "unknown";

  return {
    host,
    platform,
    bridgeAvailable: Boolean(bridge),
    addOnContextAvailable: Boolean(bridge)
  };
}

export function getAdapterProvider(): AdapterProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const bridge = getGoogleSlidesBridge();
  const hostCapabilities = getHostCapabilities();
  const capabilityRegistry = buildCapabilityRegistry(hostCapabilities, bridge);

  if (!bridge) {
    cachedProvider = createSimProvider({
      hostCapabilities,
      capabilityRegistry,
      getDocumentIdentifier
    });
    return cachedProvider;
  }

  const readDeckSnapshotCapability = buildReadDeckSnapshotCapability(capabilityRegistry);
  if (!readDeckSnapshotCapability.supported) {
    cachedProvider = createGoogleShadowProvider({
      hostCapabilities,
      capabilityRegistry,
      readDeckSnapshotCapability
    });
    return cachedProvider;
  }

  const applyPatchOpsCapability = buildApplyPatchCapability(capabilityRegistry, bridge);
  if (applyPatchOpsCapability.supported) {
    cachedProvider = createGoogleSafeProvider({
      bridge,
      hostCapabilities,
      capabilityRegistry,
      readDeckSnapshotCapability,
      applyPatchOpsCapability
    });
    return cachedProvider;
  }

  cachedProvider = createGoogleReadonlyProvider({
    bridge,
    hostCapabilities,
    capabilityRegistry,
    readDeckSnapshotCapability
  });

  return cachedProvider;
}

export function resetAdapterProviderForTests(): void {
  cachedProvider = undefined;
  resetSimDeckForTests();
}

function buildReadDeckSnapshotCapability(
  capabilityRegistry: ReturnType<typeof buildCapabilityRegistry>
): AdapterCapability {
  return capabilityRegistry.features.slidesRead;
}

function buildApplyPatchCapability(
  capabilityRegistry: ReturnType<typeof buildCapabilityRegistry>,
  bridge: ReturnType<typeof getGoogleSlidesBridge>
): AdapterCapability {
  const writeFeature = capabilityRegistry.features.slidesWrite;
  if (!writeFeature.supported) {
    return writeFeature;
  }

  if (!capabilityRegistry.policies.safeOpsOnly.supported) {
    return {
      supported: false,
      reasonCode: "POLICY_DISABLED",
      reason: capabilityRegistry.policies.safeOpsOnly.reason ?? "Safe-only policy is required."
    };
  }

  const bridgeRevisionGuard = bridge?.getCapabilities?.().revisionGuard;
  if (bridgeRevisionGuard === false) {
    return {
      supported: false,
      reasonCode: "API_LIMITATION",
      reason: "Bridge does not provide revision-guarded write support."
    };
  }

  if (typeof bridge?.applyMutations !== "function") {
    return {
      supported: false,
      reasonCode: "API_LIMITATION",
      reason: "Bridge applyMutations API is unavailable."
    };
  }

  return { supported: true };
}
