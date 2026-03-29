import type { CandidateRule, RoleV1 } from "@magistrat/shared-types";
import { describe, expect, it } from "vitest";
import { groupCandidatesByRole } from "./RuleConfirmationPanel.js";

function c(id: string, role: RoleV1, label: string, enabled = true): CandidateRule {
  return {
    id,
    role,
    property: "fontFamily",
    label,
    observedValue: "Aptos",
    enabled
  };
}

describe("groupCandidatesByRole", () => {
  it("groups candidates by role", () => {
    const grouped = groupCandidatesByRole([
      c("a", "TITLE", "Title font"),
      c("b", "BODY", "Body size"),
      c("c", "TITLE", "Title size")
    ]);

    expect(grouped.get("TITLE")?.map((x) => x.id)).toEqual(["a", "c"]);
    expect(grouped.get("BODY")?.map((x) => x.id)).toEqual(["b"]);
    expect(grouped.get("BULLET_L1")).toBeUndefined();
  });
});

