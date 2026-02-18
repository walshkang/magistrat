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
              text: "Overview"
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
        }
      ]
    }
  ]
};
