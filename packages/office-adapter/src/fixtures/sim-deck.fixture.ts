import type { DeckSnapshot } from "@magistrat/shared-types";

export const simDeckFixture: DeckSnapshot = {
  deckId: "local-document",
  generatedAtIso: "1970-01-01T00:00:00.000Z",
  slides: [
    {
      slideId: "slide-1",
      index: 1,
      title: "Sample slide",
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
              text: "Sample title",
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
              text: "Sample title"
            }
          ],
          geometry: {
            left: 20,
            top: 30,
            width: 900,
            height: 80,
            rotation: 0
          },
          supportedForAnalysis: true,
          autofitEnabled: false
        }
      ]
    }
  ]
};
