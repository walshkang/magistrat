import { describe, expect, it } from "vitest";
import { normalizePublicOrigin, resolveDevServerConfig } from "./dev-server-config.js";

describe("dev server config", () => {
  it("returns no overrides when env vars are absent", () => {
    expect(resolveDevServerConfig({})).toEqual({});
  });

  it("derives origin and allowed host from VITE_PUBLIC_ORIGIN", () => {
    expect(resolveDevServerConfig({ VITE_PUBLIC_ORIGIN: "https://abc.ngrok-free.app" })).toEqual({
      origin: "https://abc.ngrok-free.app",
      allowedHosts: ["abc.ngrok-free.app"]
    });
  });

  it("uses explicit VITE_ALLOWED_HOST when provided", () => {
    expect(
      resolveDevServerConfig({
        VITE_PUBLIC_ORIGIN: "https://abc.ngrok-free.app",
        VITE_ALLOWED_HOST: "custom-host.example.com"
      })
    ).toEqual({
      origin: "https://abc.ngrok-free.app",
      allowedHosts: ["custom-host.example.com"]
    });
  });

  it("adds secure hmr overrides when VITE_HMR_HOST is provided", () => {
    expect(resolveDevServerConfig({ VITE_HMR_HOST: "abc.ngrok-free.app" })).toEqual({
      hmr: {
        protocol: "wss",
        host: "abc.ngrok-free.app",
        clientPort: 443
      }
    });
  });

  it("rejects public origins that include path/query/hash", () => {
    expect(() => normalizePublicOrigin("https://abc.ngrok-free.app/path")).toThrow("origin only");
    expect(() => normalizePublicOrigin("https://abc.ngrok-free.app?x=1")).toThrow("origin only");
    expect(() => normalizePublicOrigin("https://abc.ngrok-free.app#hash")).toThrow("origin only");
  });
});
