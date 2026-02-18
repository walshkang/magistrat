import type { AdapterCapability, AdapterProvider, HostCapabilities } from "./adapter-types.js";
import { buildCapabilityRegistry } from "./capability-registry.js";
import { getDocumentIdentifier } from "./document-state.js";
import { createOfficeReadonlyProvider } from "./providers/office-readonly-provider.js";
import { createOfficeShadowProvider } from "./providers/office-shadow-provider.js";
import { createSimProvider, resetSimDeckForTests } from "./providers/sim-provider.js";

let cachedProvider: AdapterProvider | undefined;

export function getHostCapabilities(): HostCapabilities {
  const officeGlobal = (
    globalThis as unknown as { Office?: { context?: { host?: string; platform?: string } } }
  ).Office;
  const hostRaw = officeGlobal?.context?.host?.toLowerCase();
  const platformRaw = officeGlobal?.context?.platform?.toLowerCase();

  const host = hostRaw?.includes("powerpoint") ? "powerpoint" : "unknown";
  let platform: HostCapabilities["platform"] = "unknown";

  if (platformRaw?.includes("pc") || platformRaw?.includes("win")) {
    platform = "pc";
  } else if (platformRaw?.includes("mac")) {
    platform = "mac";
  } else if (platformRaw?.includes("officeonline") || platformRaw?.includes("web")) {
    platform = "web";
  }

  const desktopSupported = host === "powerpoint" && (platform === "pc" || platform === "mac");

  return {
    host,
    platform,
    officeAvailable: Boolean(officeGlobal),
    desktopSupported
  };
}

export function getAdapterProvider(): AdapterProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const hostCapabilities = getHostCapabilities();
  const capabilityRegistry = buildCapabilityRegistry(hostCapabilities);

  if (!hostCapabilities.officeAvailable) {
    cachedProvider = createSimProvider({
      hostCapabilities,
      capabilityRegistry,
      getDocumentIdentifier
    });
    return cachedProvider;
  }

  const readDeckSnapshotCapability = buildReadDeckSnapshotCapability(capabilityRegistry);
  if (hostCapabilities.desktopSupported && readDeckSnapshotCapability.supported) {
    cachedProvider = createOfficeReadonlyProvider({
      hostCapabilities,
      capabilityRegistry,
      getDocumentIdentifier
    });
    return cachedProvider;
  }

  cachedProvider = createOfficeShadowProvider({
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
  const requirementGate = capabilityRegistry.requirementSets.powerPointApi_1_4;
  if (!requirementGate.supported) {
    return requirementGate;
  }

  if (!hasPowerPointRun()) {
    return {
      supported: false,
      reasonCode: "API_LIMITATION",
      reason: "PowerPoint.run is unavailable."
    };
  }

  return { supported: true };
}

function hasPowerPointRun(): boolean {
  const powerPointGlobal = (
    globalThis as unknown as {
      PowerPoint?: {
        run?: unknown;
      };
    }
  ).PowerPoint;

  return typeof powerPointGlobal?.run === "function";
}
