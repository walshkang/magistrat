import { describe, expect, it } from "vitest";
import {
  exportRuleProfileJson,
  importRuleProfileJson,
  type RuleProfile
} from "../src/rule-profile.js";

function minimalValidProfile(): RuleProfile {
  return {
    id: "profile-1",
    name: "Test profile",
    updatedAtIso: "2026-01-01T00:00:00.000Z",
    sourceSlideIds: ["slide-a"],
    rules: [
      {
        id: "rule-1",
        role: "TITLE",
        property: "fontFamily",
        label: "Titles use Aptos",
        observedValue: "Aptos",
        enabled: true
      }
    ]
  };
}

describe("rule-profile JSON", () => {
  it("roundtrips a valid profile through export and import", () => {
    const profile = minimalValidProfile();
    const json = exportRuleProfileJson(profile);
    const back = importRuleProfileJson(json);
    expect(back).toEqual(profile);
  });

  it("throws Invalid rule profile when id is missing", () => {
    const bad = {
      name: "x",
      rules: []
    };
    expect(() => importRuleProfileJson(JSON.stringify(bad))).toThrow("Invalid rule profile");
  });

  it("throws Invalid rule profile for malformed JSON", () => {
    expect(() => importRuleProfileJson("{")).toThrow("Invalid rule profile");
  });
});
