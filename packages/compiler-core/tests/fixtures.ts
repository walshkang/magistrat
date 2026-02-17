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
    inferredRole: overrides.inferredRole,
    inferredRoleScore: overrides.inferredRoleScore,
    supportedForAnalysis: overrides.supportedForAnalysis ?? true,
    autofitEnabled: overrides.autofitEnabled ?? false
  };
}

export function createSlide(overrides: Partial<SlideSnapshot> = {}): SlideSnapshot {
  return {
    slideId: overrides.slideId ?? "slide-1",
    index: overrides.index ?? 1,
    title: overrides.title ?? "Slide",
    shapes: overrides.shapes ?? [createShape()]
  };
}

export function createDeck(overrides: Partial<DeckSnapshot> = {}): DeckSnapshot {
  return {
    deckId: overrides.deckId ?? "deck-1",
    generatedAtIso: overrides.generatedAtIso ?? "2026-02-17T00:00:00.000Z",
    slides: overrides.slides ?? [createSlide()]
  };
}
