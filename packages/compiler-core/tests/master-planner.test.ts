import { describe, it, expect } from "vitest";
import {
  planMasterPatches,
  type MasterLayoutSnapshot,
  type MasterLayoutPage,
} from "../src/master-planner.js";
import type { StyleMap, RoleStyleTokens } from "@magistrat/shared-types";

// ── Helpers ──

function makeTokens(overrides: Partial<RoleStyleTokens> = {}): RoleStyleTokens {
  return {
    fontFamily: "Arial",
    fontSizePt: 24,
    bold: false,
    italic: false,
    fontColor: "#003366",
    ...overrides,
  };
}

function makePage(overrides: Partial<MasterLayoutPage> = {}): MasterLayoutPage {
  return {
    objectId: "layout_001",
    pageType: "layout",
    placeholders: [],
    ...overrides,
  };
}

function makeSnapshot(pages: MasterLayoutPage[]): MasterLayoutSnapshot {
  return { pages };
}

// ── Tests ──

describe("planMasterPatches", () => {
  it("matches TITLE placeholder to TITLE role and generates text style requests", () => {
    const styleMap: StyleMap = {
      TITLE: makeTokens({ fontFamily: "Helvetica", fontSizePt: 36, bold: true, fontColor: "#112233" }),
    };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [{ objectId: "ph_title", placeholderType: "TITLE" }],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);

    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0]).toMatchObject({
      role: "TITLE",
      placeholderObjectId: "ph_title",
      pageObjectId: "layout_001",
    });
    expect(plan.skipped).toHaveLength(0);

    // Should have updateTextStyle request
    const textReq = plan.requests.find((r) => r.updateTextStyle);
    expect(textReq).toBeDefined();
    expect(textReq!.updateTextStyle!.objectId).toBe("ph_title");
    expect(textReq!.updateTextStyle!.style.fontFamily).toBe("Helvetica");
    expect(textReq!.updateTextStyle!.style.fontSize).toEqual({ magnitude: 36, unit: "PT" });
    expect(textReq!.updateTextStyle!.style.bold).toBe(true);
    expect(textReq!.updateTextStyle!.style.foregroundColor).toEqual({
      opaqueColor: {
        rgbColor: {
          red: 17 / 255,
          green: 34 / 255,
          blue: 51 / 255,
        },
      },
    });
  });

  it("matches CENTERED_TITLE to TITLE role", () => {
    const styleMap: StyleMap = { TITLE: makeTokens() };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [{ objectId: "ph_ct", placeholderType: "CENTERED_TITLE" }],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0]!.role).toBe("TITLE");
  });

  it("matches BODY and OBJECT placeholders to BODY role", () => {
    const styleMap: StyleMap = { BODY: makeTokens() };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [
          { objectId: "ph_body", placeholderType: "BODY" },
          { objectId: "ph_obj", placeholderType: "OBJECT" },
        ],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    expect(plan.matched).toHaveLength(2);
    expect(plan.matched.every((m) => m.role === "BODY")).toBe(true);
  });

  it("matches SUBTITLE placeholder to SUBTITLE role", () => {
    const styleMap: StyleMap = { SUBTITLE: makeTokens() };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [{ objectId: "ph_sub", placeholderType: "SUBTITLE" }],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0]!.role).toBe("SUBTITLE");
  });

  it("matches FOOTER, SLIDE_NUMBER, DATE_HEADER to FOOTER role", () => {
    const styleMap: StyleMap = { FOOTER: makeTokens({ fontSizePt: 10 }) };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [
          { objectId: "ph_f", placeholderType: "FOOTER" },
          { objectId: "ph_sn", placeholderType: "SLIDE_NUMBER" },
          { objectId: "ph_dh", placeholderType: "DATE_HEADER" },
        ],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    expect(plan.matched).toHaveLength(3);
    expect(plan.matched.every((m) => m.role === "FOOTER")).toBe(true);
  });

  it("skips unknown placeholder types with no_role_mapping reason", () => {
    const styleMap: StyleMap = { TITLE: makeTokens() };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [
          { objectId: "ph_title", placeholderType: "TITLE" },
          { objectId: "ph_diagram", placeholderType: "DIAGRAM" },
          { objectId: "ph_clip", placeholderType: "CLIP_ART" },
        ],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    expect(plan.matched).toHaveLength(1);
    expect(plan.skipped).toHaveLength(2);
    expect(plan.skipped[0]!.reason).toBe("no_role_mapping");
    expect(plan.skipped[0]!.placeholderType).toBe("DIAGRAM");
  });

  it("skips placeholders when StyleMap lacks the corresponding role", () => {
    const styleMap: StyleMap = { TITLE: makeTokens() }; // No BODY entry
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [
          { objectId: "ph_title", placeholderType: "TITLE" },
          { objectId: "ph_body", placeholderType: "BODY" },
        ],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    expect(plan.matched).toHaveLength(1);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]!.reason).toBe("no_stylemap_entry");
    expect(plan.skipped[0]!.placeholderType).toBe("BODY");
  });

  it("returns empty plan for empty StyleMap", () => {
    const styleMap: StyleMap = {};
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [{ objectId: "ph_title", placeholderType: "TITLE" }],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    expect(plan.requests).toHaveLength(0);
    expect(plan.matched).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]!.reason).toBe("no_stylemap_entry");
  });

  it("returns empty plan for empty masterLayouts", () => {
    const styleMap: StyleMap = { TITLE: makeTokens() };
    const snapshot = makeSnapshot([]);

    const plan = planMasterPatches(styleMap, snapshot);
    expect(plan.requests).toHaveLength(0);
    expect(plan.matched).toHaveLength(0);
    expect(plan.skipped).toHaveLength(0);
  });

  it("generates lineSpacing paragraph style request when present", () => {
    const styleMap: StyleMap = {
      TITLE: makeTokens({ lineSpacing: 1.5 }),
    };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [{ objectId: "ph_title", placeholderType: "TITLE" }],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    const paraReq = plan.requests.find((r) => r.updateParagraphStyle);
    expect(paraReq).toBeDefined();
    expect(paraReq!.updateParagraphStyle!.objectId).toBe("ph_title");
    expect(paraReq!.updateParagraphStyle!.style.lineSpacing).toBe(1.5);
  });

  it("does not generate lineSpacing request when absent", () => {
    const styleMap: StyleMap = {
      TITLE: makeTokens(), // no lineSpacing
    };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [{ objectId: "ph_title", placeholderType: "TITLE" }],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    const paraReq = plan.requests.find((r) => r.updateParagraphStyle);
    expect(paraReq).toBeUndefined();
  });

  it("processes multiple pages (master + layouts)", () => {
    const styleMap: StyleMap = {
      TITLE: makeTokens(),
      BODY: makeTokens({ fontSizePt: 14 }),
    };
    const snapshot = makeSnapshot([
      makePage({
        objectId: "master_001",
        pageType: "master",
        placeholders: [{ objectId: "m_ph_title", placeholderType: "TITLE" }],
      }),
      makePage({
        objectId: "layout_title_slide",
        pageType: "layout",
        placeholders: [
          { objectId: "l_ph_title", placeholderType: "CENTERED_TITLE" },
          { objectId: "l_ph_body", placeholderType: "BODY" },
        ],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    expect(plan.matched).toHaveLength(3);
    expect(plan.matched.some((m) => m.pageType === "master")).toBe(true);
    expect(plan.matched.some((m) => m.pageType === "layout")).toBe(true);
  });

  it("does not generate fill request for non-CALLOUT roles", () => {
    const styleMap: StyleMap = {
      TITLE: makeTokens({ fillColor: "#FF0000" }),
    };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [{ objectId: "ph_title", placeholderType: "TITLE" }],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    const fillReq = plan.requests.find((r) => r.updateShapeProperties);
    expect(fillReq).toBeUndefined();
  });

  it("generates foregroundColor field string correctly", () => {
    const styleMap: StyleMap = {
      BODY: makeTokens({ fontColor: "#AABBCC" }),
    };
    const snapshot = makeSnapshot([
      makePage({
        placeholders: [{ objectId: "ph_body", placeholderType: "BODY" }],
      }),
    ]);

    const plan = planMasterPatches(styleMap, snapshot);
    const textReq = plan.requests.find((r) => r.updateTextStyle);
    expect(textReq!.updateTextStyle!.fields).toContain("foregroundColor");
  });
});
