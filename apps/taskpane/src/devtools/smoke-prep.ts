import { normalizeHttpsOrigin } from "./manifest-materializer.js";

export interface MaterializeSmokeEnvFileOptions {
  origin: string;
}

export interface MaterializeSmokeEnvFileResult {
  origin: string;
  host: string;
  contents: string;
}

export function materializeSmokeEnvFile(
  options: MaterializeSmokeEnvFileOptions
): MaterializeSmokeEnvFileResult {
  const { origin, host } = normalizeHttpsOrigin(options.origin);

  const contents = [
    `VITE_PUBLIC_ORIGIN=${origin}`,
    `VITE_ALLOWED_HOST=${host}`,
    `VITE_HMR_HOST=${host}`,
    ""
  ].join("\n");

  return {
    origin,
    host,
    contents
  };
}
