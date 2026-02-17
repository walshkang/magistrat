import { describe, expect, it } from "vitest";
import { scoreExemplarHealth } from "../src/public-api.js";
import { createShape, createSlide } from "./fixtures.js";

describe("scoreExemplarHealth", () => {
  it("scores stable exemplar higher than noisy exemplar", () => {
    const stable = createSlide({
      shapes: [
        createShape({
          objectId: "title",
          geometry: { left: 20, top: 40, width: 900, height: 80, rotation: 0 },
          textRuns: [
            {
              text: "Title",
              fontFamily: "Aptos Display",
              fontSizePt: 30,
              bold: true,
              italic: false,
              fontColor: "#111111",
              fontAlpha: 1
            }
          ]
        }),
        createShape({
          objectId: "body",
          geometry: { left: 40, top: 200, width: 900, height: 240, rotation: 0 },
          textRuns: [
            {
              text: "Body content",
              fontFamily: "Aptos",
              fontSizePt: 14,
              bold: false,
              italic: false,
              fontColor: "#222222",
              fontAlpha: 1
            }
          ]
        })
      ]
    });

    const noisy = createSlide({
      shapes: [
        createShape({
          objectId: "noisy-1",
          visible: false,
          geometry: { left: 5000, top: 5000, width: 300, height: 60, rotation: 0 },
          textRuns: [
            {
              text: "Click to add title",
              fontFamily: "Calibri",
              fontSizePt: 44,
              bold: true,
              italic: true,
              fontColor: "#abcdef",
              fontAlpha: 0
            }
          ]
        }),
        createShape({
          objectId: "noisy-2",
          textRuns: [
            {
              text: "Lorem ipsum",
              fontFamily: "Times New Roman",
              fontSizePt: 11,
              bold: false,
              italic: false,
              fontColor: "#444444",
              fontAlpha: 1
            }
          ]
        })
      ]
    });

    const stableScore = scoreExemplarHealth(stable).score;
    const noisyScore = scoreExemplarHealth(noisy).score;

    expect(stableScore).toBeGreaterThan(noisyScore);
    expect(noisyScore).toBeLessThanOrEqual(70);
  });
});
