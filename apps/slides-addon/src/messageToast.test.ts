import { describe, expect, it } from "vitest";
import { messageLooksPersistent } from "./messageToast.js";

describe("messageLooksPersistent", () => {
  it("treats common failure copy as persistent", () => {
    expect(messageLooksPersistent("Initialization failed")).toBe(true);
    expect(messageLooksPersistent("Bridge unavailable")).toBe(true);
    expect(messageLooksPersistent("Something failed to load")).toBe(true);
    expect(messageLooksPersistent("Error: no deck")).toBe(true);
  });

  it("treats success and neutral copy as transient", () => {
    expect(messageLooksPersistent("Applied 3 patches")).toBe(false);
    expect(messageLooksPersistent("Scan complete")).toBe(false);
  });
});
