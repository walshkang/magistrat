import type { DeckSnapshot, ShapeSnapshot, SlideSnapshot } from "@magistrat/shared-types";

export function createShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return {
    objectId: overrides.objectId ?? "shape-1",
    name: overrides.name ?? "Shape",
    shapeType: overrides.shapeType ?? "TEXT",
    visible: overrides.visible ?? true,
    grouped: overrides.grouped ?? false,
    zIndex: overrides.zIndex ?? 1,
    textRuns: overrides.textRuns ?? [
      {
        text: "Default text",
        fontFamily: "Aptos",
        fontSizePt: 18,
        bold: false,
        italic: false,
        fontColor: "#000000",
        fontAlpha: 1
      }
    ],
    paragraphs: overrides.paragraphs ?? [
      {
        level: 0,
        bulletIndent: 18,
        bulletHanging: 9,
        lineSpacing: 1.2,
        text: "Default text"
      }
    ],
    geometry: overrides.geometry ?? {
      left: 40,
      top: 140,
      width: 500,
      height: 60,
      rotation: 0
    },
    fillColor: overrides.fillColor,
    fillAlpha: overrides.fillAlpha,
    lineColor: overrides.lineColor,
    lineWidth: overrides.lineWidth,
    inferredRole: overrides.inferredRole,
    inferredRoleScore: overrides.inferredRoleScore,
    supportedForAnalysis: overrides.supportedForAnalysis ?? true,
    autofitEnabled: overrides.autofitEnabled ?? false,
    inspectability: overrides.inspectability ?? {
      typography: true,
      bullets: true
    },
    ...(overrides.table !== undefined ? { table: overrides.table } : {}),
    ...(overrides.imageMetadata !== undefined ? { imageMetadata: overrides.imageMetadata } : {}),
    ...(overrides.chart !== undefined ? { chart: overrides.chart } : {})
  };
}

export function createTableShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    shapeType: "TABLE",
    supportedForAnalysis: false,
    textRuns: [],
    paragraphs: [],
    inspectability: { typography: false, bullets: false },
    table: {
      rows: 2,
      columns: 2,
      cells: [
        {
          rowIndex: 0,
          columnIndex: 0,
          fillColor: "#003366",
          text: "Header 1",
          textRuns: [
            {
              text: "Header 1",
              fontFamily: "Aptos",
              fontSizePt: 12,
              bold: true,
              italic: false,
              fontColor: "#FFFFFF",
              fontAlpha: 1
            }
          ],
          textAlignment: "LEFT"
        },
        {
          rowIndex: 0,
          columnIndex: 1,
          fillColor: "#003366",
          text: "Header 2",
          textRuns: [
            {
              text: "Header 2",
              fontFamily: "Aptos",
              fontSizePt: 12,
              bold: true,
              italic: false,
              fontColor: "#FFFFFF",
              fontAlpha: 1
            }
          ],
          textAlignment: "LEFT"
        },
        {
          rowIndex: 1,
          columnIndex: 0,
          text: "Data 1",
          textRuns: [
            {
              text: "Data 1",
              fontFamily: "Aptos",
              fontSizePt: 12,
              bold: false,
              italic: false,
              fontColor: "#000000",
              fontAlpha: 1
            }
          ],
          textAlignment: "LEFT"
        },
        {
          rowIndex: 1,
          columnIndex: 1,
          text: "Data 2",
          textRuns: [
            {
              text: "Data 2",
              fontFamily: "Aptos",
              fontSizePt: 12,
              bold: false,
              italic: false,
              fontColor: "#000000",
              fontAlpha: 1
            }
          ],
          textAlignment: "RIGHT"
        }
      ]
    },
    ...overrides
  });
}

export function createImageShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    shapeType: "IMAGE",
    supportedForAnalysis: false,
    textRuns: [],
    paragraphs: [],
    inspectability: { typography: false, bullets: false },
    geometry: {
      left: 100,
      top: 100,
      width: 300,
      height: 225,
      rotation: 0
    },
    imageMetadata: {
      intrinsicWidth: 300,
      intrinsicHeight: 225
    },
    ...overrides
  });
}

export function createChartShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    shapeType: "CHART",
    supportedForAnalysis: false,
    textRuns: [],
    paragraphs: [],
    inspectability: { typography: false, bullets: false },
    chart: {
      chartType: "BAR",
      series: [
        { index: 0, color: "#4285F4" },
        { index: 1, color: "#EA4335" },
      ],
      axes: [
        { position: "BOTTOM_AXIS", title: "Quarter" },
        { position: "LEFT_AXIS", title: "Revenue ($M)" },
      ],
      hasDataLabels: false,
    },
    ...overrides
  });
}

export function createSlide(overrides: Partial<SlideSnapshot> = {}): SlideSnapshot {
  return {
    slideId: overrides.slideId ?? "slide-1",
    index: overrides.index ?? 1,
    title: overrides.title ?? "Slide",
    slideWidth: overrides.slideWidth ?? 720,
    slideHeight: overrides.slideHeight ?? 405,
    shapes: overrides.shapes ?? [createShape()]
  };
}

export function createDeck(overrides: Partial<DeckSnapshot> = {}): DeckSnapshot {
  return {
    deckId: overrides.deckId ?? "deck-1",
    generatedAtIso: overrides.generatedAtIso ?? "2026-02-17T00:00:00.000Z",
    masterLayoutMetadataAvailable: overrides.masterLayoutMetadataAvailable ?? true,
    slides: overrides.slides ?? [createSlide()]
  };
}

/** Bottom-of-slide overflow body text (large font) — must not be misclassified as FOOTER. */
export function makeOverflowBodyShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    objectId: overrides.objectId ?? "overflow-body",
    geometry: { left: 60, top: 360, width: 500, height: 30, rotation: 0 },
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
    ...overrides
  });
}

/** Legitimate footer band: low in slide, small type. */
export function makeFooterBandShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    objectId: overrides.objectId ?? "footer-band",
    geometry: { left: 600, top: 390, width: 80, height: 14, rotation: 0 },
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
    ...overrides
  });
}

/** Subtitle placeholder band — mid-upper slide, subtitle-sized type. */
export function makeSubtitleBandShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    objectId: overrides.objectId ?? "subtitle-band",
    geometry: { left: 40, top: 185, width: 640, height: 40, rotation: 0 },
    textRuns: [
      {
        text: "Section overview",
        fontFamily: "Aptos",
        fontSizePt: 18,
        bold: false,
        italic: false,
        fontColor: "#112233",
        fontAlpha: 1
      }
    ],
    paragraphs: [{ level: 0, text: "Section overview" }],
    ...overrides
  });
}

/** Small top-left UNKNOWN text used as exemplar for breadcrumb horizontal band. */
export function makeBreadcrumbBandUnknownShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    objectId: overrides.objectId ?? "breadcrumb-unknown",
    geometry: { left: 30, top: 20, width: 120, height: 18, rotation: 0 },
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
    ...overrides
  });
}

/** Title-sized top band shape (scores TITLE) for negative layout tests. */
export function makeTitleBandShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    objectId: overrides.objectId ?? "title-band",
    geometry: { left: 24, top: 40, width: 640, height: 80, rotation: 0 },
    textRuns: [
      {
        text: "Slide title",
        fontFamily: "Aptos Display",
        fontSizePt: 30,
        bold: true,
        italic: false,
        fontColor: "#112233",
        fontAlpha: 1
      }
    ],
    paragraphs: [{ level: 0, text: "Slide title" }],
    ...overrides
  });
}
