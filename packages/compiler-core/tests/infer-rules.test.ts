import type { RoleStyleTokens, StyleMap } from "@magistrat/shared-types";
import { describe, expect, it } from "vitest";
import { buildStyleMap, inferCandidateRules, inferRoles, mergeStyleMaps } from "../src/public-api.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";

function tokens(partial: Partial<RoleStyleTokens> & Pick<RoleStyleTokens, "fontFamily" | "fontSizePt">): RoleStyleTokens {
  return {
    bold: false,
    italic: false,
    fontColor: "#000000",
    ...partial
  };
}

describe("inferCandidateRules", () => {
  it("infers typography rules from a simple exemplar", () => {
    const exemplar = createSlide({
      slideId: "ex",
      shapes: [
        createShape({
          objectId: "title",
          geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
          textRuns: [
            {
              text: "Hello World",
              fontFamily: "Aptos Display",
              fontSizePt: 30,
              bold: true,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ],
          paragraphs: [{ level: 0, text: "Hello World", lineSpacing: 1.2 }]
        })
      ]
    });

    const deck = createDeck({ slides: [exemplar] });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(inferred.deck.slides[0]!, "original");
    const { candidates } = inferCandidateRules(styleMap);

    // Should have rules for fontFamily, fontSizePt, bold, italic, fontColor, lineSpacing
    const titleRules = candidates.filter((c) => c.role === "TITLE");
    expect(titleRules.length).toBeGreaterThanOrEqual(5);

    const fontFamilyRule = titleRules.find((c) => c.property === "fontFamily");
    expect(fontFamilyRule).toBeDefined();
    expect(fontFamilyRule?.observedValue).toBe("Aptos Display");
    expect(fontFamilyRule?.enabled).toBe(true);
    expect(fontFamilyRule?.label).toContain("Aptos Display");

    const sizeRule = titleRules.find((c) => c.property === "fontSizePt");
    expect(sizeRule?.observedValue).toBe(30);

    const boldRule = titleRules.find((c) => c.property === "bold");
    expect(boldRule?.observedValue).toBe(true);
    expect(boldRule?.label).toContain("bold");
  });

  it("infers bullet rules when present", () => {
    const exemplar = createSlide({
      slideId: "ex",
      shapes: [
        createShape({
          objectId: "bullets",
          geometry: { left: 64, top: 160, width: 760, height: 200, rotation: 0 },
          textRuns: [
            {
              text: "Item one\nItem two",
              fontFamily: "Aptos",
              fontSizePt: 18,
              bold: false,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ],
          paragraphs: [
            { level: 1, text: "Item one", bulletIndent: 18, bulletHanging: 9, bulletGlyph: "•" },
            { level: 1, text: "Item two", bulletIndent: 18, bulletHanging: 9, bulletGlyph: "•" }
          ],
          inspectability: { typography: true, bullets: true }
        })
      ]
    });

    const deck = createDeck({ slides: [exemplar] });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(inferred.deck.slides[0]!, "original");
    const { candidates } = inferCandidateRules(styleMap);

    const bulletIndentRule = candidates.find(
      (c) => c.property === "bulletIndent"
    );
    expect(bulletIndentRule).toBeDefined();
    expect(bulletIndentRule?.label).toContain("indent");

    const glyphRule = candidates.find((c) => c.property === "bulletGlyph");
    expect(glyphRule).toBeDefined();
    expect(glyphRule?.observedValue).toBe("•");
  });

  it("produces stable IDs across repeated calls", () => {
    const exemplar = createSlide({
      slideId: "ex",
      shapes: [
        createShape({
          objectId: "title",
          geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
          textRuns: [
            {
              text: "Test",
              fontFamily: "Arial",
              fontSizePt: 24,
              bold: false,
              italic: false,
              fontColor: "#000000",
              fontAlpha: 1
            }
          ],
          paragraphs: [{ level: 0, text: "Test" }]
        })
      ]
    });

    const deck = createDeck({ slides: [exemplar] });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(inferred.deck.slides[0]!, "original");

    const result1 = inferCandidateRules(styleMap);
    const result2 = inferCandidateRules(styleMap);

    expect(result1.candidates.map((c) => c.id)).toEqual(result2.candidates.map((c) => c.id));
  });

  it("infers layout band rule when geometry cluster exists", () => {
    const exemplar = createSlide({
      slideId: "ex",
      shapes: [
        createShape({
          objectId: "title",
          geometry: { left: 24, top: 32, width: 900, height: 100, rotation: 0 },
          textRuns: [
            {
              text: "Title",
              fontFamily: "Aptos Display",
              fontSizePt: 30,
              bold: true,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ],
          paragraphs: [{ level: 0, text: "Title" }]
        })
      ]
    });

    const deck = createDeck({ slides: [exemplar] });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(inferred.deck.slides[0]!, "original");
    const { candidates } = inferCandidateRules(styleMap);

    const geoRule = candidates.find((c) => c.property === "geometryBand" && c.role === "TITLE");
    expect(geoRule).toBeDefined();
    expect(geoRule?.label).toContain("position band");
  });

  it("returns empty candidates for empty style map", () => {
    const { candidates } = inferCandidateRules({});
    expect(candidates).toEqual([]);
  });

  it("infers alignment candidate when tokens include alignment", () => {
    const styleMap: StyleMap = {
      BODY: tokens({ fontFamily: "Aptos", fontSizePt: 14, alignment: "LEFT" })
    };
    const { candidates } = inferCandidateRules(styleMap);
    const alignmentRule = candidates.find((c) => c.role === "BODY" && c.property === "alignment");
    expect(alignmentRule?.observedValue).toBe("LEFT");
    expect(alignmentRule?.label).toContain("LEFT");
  });
});

describe("mergeStyleMaps", () => {
  it("merges non-overlapping roles so both roles appear in the result", () => {
    const primary: StyleMap = {
      TITLE: tokens({ fontFamily: "Primary", fontSizePt: 28 })
    };
    const additional: StyleMap = {
      BODY: tokens({ fontFamily: "BodyFont", fontSizePt: 14 })
    };
    const merged = mergeStyleMaps(primary, additional);
    expect(merged.TITLE).toEqual(primary.TITLE);
    expect(merged.BODY).toEqual(additional.BODY);
  });

  it("keeps primary tokens when both maps define the same role", () => {
    const primary: StyleMap = {
      TITLE: tokens({ fontFamily: "PrimaryTitle", fontSizePt: 32 })
    };
    const additional: StyleMap = {
      TITLE: tokens({ fontFamily: "OtherTitle", fontSizePt: 40 })
    };
    const merged = mergeStyleMaps(primary, additional);
    expect(merged.TITLE).toEqual(primary.TITLE);
    expect(merged.TITLE?.fontFamily).toBe("PrimaryTitle");
  });

  it("returns primary unchanged when there are no additional maps", () => {
    const primary: StyleMap = {
      TITLE: tokens({ fontFamily: "Only", fontSizePt: 24 })
    };
    const merged = mergeStyleMaps(primary);
    expect(merged).toEqual(primary);
  });
});
