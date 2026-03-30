import type { DeckSnapshot, ShapeSnapshot } from "@magistrat/shared-types";

/** Breadcrumb — top-left band, small text */
function makeSimBreadcrumbShape(): ShapeSnapshot {
  return {
    objectId: "shape-breadcrumb",
    name: "Breadcrumb",
    shapeType: "TEXT",
    visible: true,
    grouped: false,
    zIndex: 0,
    textRuns: [
      {
        text: "Section 1",
        fontFamily: "Aptos",
        fontSizePt: 10,
        bold: false,
        italic: false,
        fontColor: "#445566",
        fontAlpha: 1
      }
    ],
    paragraphs: [{ level: 0, text: "Section 1" }],
    geometry: {
      left: 30,
      top: 20,
      width: 120,
      height: 18,
      rotation: 0
    },
    supportedForAnalysis: true,
    autofitEnabled: false,
    inspectability: {
      typography: true,
      bullets: false
    }
  };
}

/** Legitimate footer — above old 470 rule but within new footer threshold band */
function makeSimFooterBandShape(): ShapeSnapshot {
  return {
    objectId: "shape-footer-acme",
    name: "Footer",
    shapeType: "TEXT",
    visible: true,
    grouped: false,
    zIndex: 5,
    textRuns: [
      {
        text: "Acme Corp",
        fontFamily: "Aptos",
        fontSizePt: 10,
        bold: false,
        italic: false,
        fontColor: "#666666",
        fontAlpha: 1
      }
    ],
    paragraphs: [{ level: 0, text: "Acme Corp" }],
    geometry: {
      left: 600,
      top: 390,
      width: 80,
      height: 14,
      rotation: 0
    },
    supportedForAnalysis: true,
    autofitEnabled: false,
    inspectability: {
      typography: true,
      bullets: false
    }
  };
}

/** Overflow body — must NOT score as FOOTER under tightened rules */
function makeSimOverflowBodyShape(): ShapeSnapshot {
  return {
    objectId: "shape-overflow-body",
    name: "Overflow body",
    shapeType: "TEXT",
    visible: true,
    grouped: false,
    zIndex: 6,
    textRuns: [
      {
        text: "Additional context that didn't fit",
        fontFamily: "Aptos",
        fontSizePt: 18,
        bold: false,
        italic: false,
        fontColor: "#333333",
        fontAlpha: 1
      }
    ],
    paragraphs: [{ level: 0, text: "Additional context that didn't fit" }],
    geometry: {
      left: 60,
      top: 360,
      width: 500,
      height: 30,
      rotation: 0
    },
    supportedForAnalysis: true,
    autofitEnabled: false,
    inspectability: {
      typography: true,
      bullets: false
    }
  };
}

export const simDeckFixture: DeckSnapshot = {
  deckId: "sim-google-deck",
  generatedAtIso: "2026-02-18T00:00:00.000Z",
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
        },
        makeSimBreadcrumbShape()
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
          geometry: {
            left: 64,
            top: 160,
            width: 760,
            height: 160,
            rotation: 0
          },
          supportedForAnalysis: true,
          autofitEnabled: false,
          inspectability: {
            typography: true,
            bullets: false
          }
        },
        makeSimFooterBandShape(),
        makeSimOverflowBodyShape(),
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
