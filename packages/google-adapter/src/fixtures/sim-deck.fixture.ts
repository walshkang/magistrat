import type { DeckSnapshot } from "@magistrat/shared-types";

export const simDeckFixture: DeckSnapshot = {
  deckId: "sim-google-deck",
  generatedAtIso: "2026-02-18T00:00:00.000Z",
  slides: [
    {
      slideId: "slide-1",
      index: 1,
      title: "Agenda",
      shapes: [
        {
          objectId: "shape-title",
          name: "Title",
          shapeType: "TEXT",
          visible: true,
          grouped: false,
          zIndex: 1,
          textRuns: [
            {
              text: "Agenda",
              fontFamily: "Aptos Display",
              fontSizePt: 30,
              bold: true,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ],
          paragraphs: [
            {
              level: 0,
              text: "Agenda"
            }
          ],
          geometry: {
            left: 24,
            top: 32,
            width: 900,
            height: 100,
            rotation: 0
          },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: {
            typography: true,
            bullets: false
          }
        },
        {
          objectId: "shape-bullets",
          name: "Agenda bullets",
          shapeType: "TEXT",
          visible: true,
          grouped: false,
          zIndex: 2,
          textRuns: [
            {
              text: "Overview\nMarket\nPlan",
              fontFamily: "Aptos",
              fontSizePt: 20,
              bold: false,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ],
          paragraphs: [
            {
              level: 0,
              text: "Overview",
              bulletIndent: 18,
              bulletHanging: 8
            },
            {
              level: 0,
              text: "Market",
              bulletIndent: 18,
              bulletHanging: 8
            },
            {
              level: 0,
              text: "Plan",
              bulletIndent: 18,
              bulletHanging: 8
            }
          ],
          geometry: {
            left: 64,
            top: 180,
            width: 760,
            height: 240,
            rotation: 0
          },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: {
            typography: true,
            bullets: true
          }
        }
      ]
    },
    {
      slideId: "slide-2",
      index: 2,
      title: "Overview",
      shapes: [
        {
          objectId: "shape-overview-title",
          name: "Title",
          shapeType: "TEXT",
          visible: true,
          grouped: false,
          zIndex: 1,
          textRuns: [
            {
              text: "Overview",
              fontFamily: "Aptos Display",
              fontSizePt: 30,
              bold: true,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ],
          paragraphs: [
            {
              level: 0,
              text: "Overview",
              lineSpacing: 1.5
            }
          ],
          geometry: {
            left: 24,
            top: 32,
            width: 900,
            height: 100,
            rotation: 0
          },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: {
            typography: true,
            bullets: false
          }
        },
        {
          objectId: "shape-semi-transparent",
          name: "Faded note",
          shapeType: "TEXT",
          visible: true,
          grouped: false,
          zIndex: 2,
          textRuns: [
            {
              text: "Draft — do not distribute",
              fontFamily: "Aptos",
              fontSizePt: 14,
              bold: false,
              italic: true,
              fontColor: "#888888",
              fontAlpha: 0.4
            }
          ],
          paragraphs: [
            {
              level: 0,
              text: "Draft — do not distribute"
            }
          ],
          geometry: {
            left: 200,
            top: 350,
            width: 300,
            height: 40,
            rotation: 0
          },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: {
            typography: true,
            bullets: false
          }
        },
        {
          objectId: "shape-off-slide",
          name: "Stray textbox",
          shapeType: "TEXT",
          visible: true,
          grouped: false,
          zIndex: 3,
          textRuns: [
            {
              text: "old notes",
              fontFamily: "Aptos",
              fontSizePt: 12,
              bold: false,
              italic: false,
              fontColor: "#333333",
              fontAlpha: 1
            }
          ],
          paragraphs: [
            {
              level: 0,
              text: "old notes"
            }
          ],
          geometry: {
            left: 800,
            top: 500,
            width: 200,
            height: 60,
            rotation: 0
          },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: {
            typography: true,
            bullets: false
          }
        }
      ]
    },
    {
      slideId: "slide-3",
      index: 3,
      title: "Market",
      shapes: [
        {
          objectId: "shape-market-title",
          name: "Title",
          shapeType: "TEXT",
          visible: true,
          grouped: false,
          zIndex: 1,
          textRuns: [
            {
              text: "Market",
              fontFamily: "Aptos Display",
              fontSizePt: 30,
              bold: true,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ],
          paragraphs: [
            {
              level: 0,
              text: "Market"
            }
          ],
          geometry: {
            left: 24,
            top: 32,
            width: 900,
            height: 100,
            rotation: 0
          },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: {
            typography: true,
            bullets: false
          }
        },
        {
          objectId: "shape-market-bullets",
          name: "Bullet list",
          shapeType: "TEXT",
          visible: true,
          grouped: false,
          zIndex: 2,
          textRuns: [
            {
              text: "TAM is $4B and growing",
              fontFamily: "Aptos",
              fontSizePt: 18,
              bold: false,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ],
          paragraphs: [
            {
              level: 1,
              text: "TAM is $4B and growing",
              bulletIndent: 18,
              bulletHanging: 9,
              bulletGlyph: "–"
            }
          ],
          geometry: {
            left: 64,
            top: 160,
            width: 760,
            height: 200,
            rotation: 0
          },
          inferredRole: "BULLET_L1",
          inferredRoleScore: 0.95,
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: {
            typography: true,
            bullets: true
          }
        }
      ]
    }
  ]
};
