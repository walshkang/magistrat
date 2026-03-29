import type { DeckSnapshot } from "@magistrat/shared-types";

export const simDeckFixture: DeckSnapshot = {
  deckId: "local-document",
  generatedAtIso: "1970-01-01T00:00:00.000Z",
  masterLayoutMetadataAvailable: true,
  slides: [
    {
      slideId: "slide-1",
      index: 1,
      title: "Agenda",
      slideWidth: 720,
      slideHeight: 405,
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
            { level: 0, text: "Overview", bulletIndent: 18, bulletHanging: 8 },
            { level: 0, text: "Market", bulletIndent: 18, bulletHanging: 8 },
            { level: 0, text: "Plan", bulletIndent: 18, bulletHanging: 8 }
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
      slideWidth: 720,
      slideHeight: 405,
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
          paragraphs: [{ level: 0, text: "Overview", lineSpacing: 1.5 }],
          geometry: { left: 24, top: 32, width: 900, height: 100, rotation: 0 },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: { typography: true, bullets: false }
        },
        {
          objectId: "shape-overview-body",
          name: "Body text",
          shapeType: "TEXT",
          visible: true,
          grouped: false,
          zIndex: 4,
          textRuns: [
            {
              text: "This quarter we launched three new product lines across APAC.",
              fontFamily: "Calibri",
              fontSizePt: 20,
              bold: false,
              italic: false,
              fontColor: "#445566",
              fontAlpha: 1
            }
          ],
          paragraphs: [
            {
              level: 0,
              text: "This quarter we launched three new product lines across APAC.",
              lineSpacing: 1.2
            }
          ],
          geometry: { left: 64, top: 160, width: 760, height: 160, rotation: 0 },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: { typography: true, bullets: false }
        }
      ]
    },
    {
      slideId: "slide-3",
      index: 3,
      title: "Market",
      slideWidth: 720,
      slideHeight: 405,
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
              fontFamily: "Arial",
              fontSizePt: 30,
              bold: true,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ],
          paragraphs: [{ level: 0, text: "Market" }],
          geometry: { left: 24, top: 32, width: 900, height: 100, rotation: 0 },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: { typography: true, bullets: false }
        }
      ]
    }
  ]
};
