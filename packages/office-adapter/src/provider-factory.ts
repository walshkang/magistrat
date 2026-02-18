import type { AdapterProvider, HostCapabilities } from "./adapter-types.js";
import { getDocumentIdentifier } from "./document-state.js";
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
  if (hostCapabilities.officeAvailable && hostCapabilities.desktopSupported) {
    cachedProvider = createOfficeShadowProvider({ hostCapabilities });
    return cachedProvider;
  }

  cachedProvider = createSimProvider({
    hostCapabilities,
    getDocumentIdentifier
  });
  return cachedProvider;
}

export function resetAdapterProviderForTests(): void {
  cachedProvider = undefined;
  resetSimDeckForTests();
}
