export interface DevServerEnv {
  VITE_PUBLIC_ORIGIN?: string;
  VITE_ALLOWED_HOST?: string;
  VITE_HMR_HOST?: string;
}

export interface DevServerConfigOverrides {
  origin?: string;
  allowedHosts?: string[];
  hmr?: {
    protocol: "wss";
    host: string;
    clientPort: 443;
  };
}

export function resolveDevServerConfig(env: DevServerEnv): DevServerConfigOverrides {
  const publicOriginRaw = env.VITE_PUBLIC_ORIGIN?.trim();
  const allowedHostRaw = env.VITE_ALLOWED_HOST?.trim();
  const hmrHostRaw = env.VITE_HMR_HOST?.trim();

  const overrides: DevServerConfigOverrides = {};
  let derivedHost: string | undefined;

  if (publicOriginRaw) {
    const { origin, host } = normalizePublicOrigin(publicOriginRaw);
    overrides.origin = origin;
    derivedHost = host;
  }

  const allowedHost = allowedHostRaw && allowedHostRaw.length > 0 ? allowedHostRaw : derivedHost;
  if (allowedHost) {
    overrides.allowedHosts = [allowedHost];
  }

  if (hmrHostRaw && hmrHostRaw.length > 0) {
    overrides.hmr = {
      protocol: "wss",
      host: hmrHostRaw,
      clientPort: 443
    };
  }

  return overrides;
}

export function normalizePublicOrigin(value: string): { origin: string; host: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`VITE_PUBLIC_ORIGIN must be a valid URL origin. Received: ${value}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`VITE_PUBLIC_ORIGIN must use http or https. Received protocol: ${url.protocol}`);
  }

  if (url.pathname !== "/" || url.search.length > 0 || url.hash.length > 0) {
    throw new Error("VITE_PUBLIC_ORIGIN must be an origin only (no path, query, or hash).");
  }

  return {
    origin: url.origin,
    host: url.host
  };
}
