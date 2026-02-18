import { describe, expect, it } from "vitest";
import { materializeSmokeEnvFile } from "./smoke-prep.js";

describe("smoke prep", () => {
  it("materializes deterministic vite tunnel overrides", () => {
    expect(materializeSmokeEnvFile({ origin: "https://abc.ngrok-free.app" })).toEqual({
      origin: "https://abc.ngrok-free.app",
      host: "abc.ngrok-free.app",
      contents:
        "VITE_PUBLIC_ORIGIN=https://abc.ngrok-free.app\n" +
        "VITE_ALLOWED_HOST=abc.ngrok-free.app\n" +
        "VITE_HMR_HOST=abc.ngrok-free.app\n"
    });
  });

  it("rejects non-https origins", () => {
    expect(() => materializeSmokeEnvFile({ origin: "http://localhost:3010" })).toThrow("HTTPS");
  });

  it("rejects origin values with path/query/hash", () => {
    expect(() => materializeSmokeEnvFile({ origin: "https://abc.ngrok-free.app/path" })).toThrow(
      "origin only"
    );
    expect(() => materializeSmokeEnvFile({ origin: "https://abc.ngrok-free.app?x=1" })).toThrow(
      "origin only"
    );
    expect(() => materializeSmokeEnvFile({ origin: "https://abc.ngrok-free.app#hash" })).toThrow(
      "origin only"
    );
  });
});
