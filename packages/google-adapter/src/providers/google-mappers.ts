import type { DeckSnapshot, ShapeSnapshot, ShapeType } from "@magistrat/shared-types";
import type { GoogleBridgePageElement, GoogleBridgePresentation } from "../bridge-types.js";

export function mapPresentationToDeckSnapshot(presentation: GoogleBridgePresentation): DeckSnapshot {
  const slides = [...presentation.slides]
    .sort((a, b) => a.index - b.index || a.slideId.localeCompare(b.slideId))
    .map((slide) => ({
      slideId: slide.slideId,
      index: slide.index,
      title: slide.title ?? "",
      shapes: [...slide.pageElements]
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0) || a.objectId.localeCompare(b.objectId))
        .map(mapPageElement)
    }));

  return {
    deckId: presentation.documentId,
    generatedAtIso: new Date().toISOString(),
    slides
  };
}

export function mapPageElement(element: GoogleBridgePageElement): ShapeSnapshot {
  const shapeType = normalizeShapeType(element.elementType);
  const runs = element.text?.runs ?? [];
  const paragraphs = element.text?.paragraphs ?? [];

  const inferredTypographyInspectable =
    runs.length > 0 &&
    runs.every(
      (run) =>
        typeof run.fontFamily === "string" &&
        typeof run.fontSizePt === "number" &&
        typeof run.bold === "boolean" &&
        typeof run.italic === "boolean" &&
        typeof run.fontColor === "string"
    );

  return {
    objectId: element.objectId,
    name: element.name ?? "PageElement",
    shapeType,
    visible: element.visible ?? true,
    grouped: element.grouped ?? false,
    zIndex: element.zIndex ?? 0,
    textRuns: runs.map((run) => ({
      text: run.text,
      fontFamily: run.fontFamily ?? "",
      fontSizePt: run.fontSizePt ?? 0,
      bold: run.bold ?? false,
      italic: run.italic ?? false,
      fontColor: normalizeColor(run.fontColor ?? "#000000"),
      fontAlpha: run.fontAlpha ?? 1,
      ...(run.proofingLanguage ? { proofingLanguage: run.proofingLanguage } : {})
    })),
    paragraphs: paragraphs.map((paragraph) => ({
      level: normalizeLevel(paragraph.level),
      text: paragraph.text,
      ...(typeof paragraph.bulletIndent === "number" ? { bulletIndent: paragraph.bulletIndent } : {}),
      ...(typeof paragraph.bulletHanging === "number" ? { bulletHanging: paragraph.bulletHanging } : {}),
      ...(typeof paragraph.lineSpacing === "number" ? { lineSpacing: paragraph.lineSpacing } : {}),
      ...(typeof paragraph.bulletGlyph === "string" ? { bulletGlyph: paragraph.bulletGlyph } : {})
    })),
    geometry: {
      left: element.geometry?.left ?? 0,
      top: element.geometry?.top ?? 0,
      width: element.geometry?.width ?? 0,
      height: element.geometry?.height ?? 0,
      rotation: element.geometry?.rotation ?? 0
    },
    supportedForAnalysis: shapeType === "TEXT",
    autofitEnabled: element.text?.autofitEnabled ?? false,
    inspectability: {
      typography: element.text?.inspectability?.typography ?? inferredTypographyInspectable,
      bullets: element.text?.inspectability?.bullets ?? paragraphs.length > 0
    }
  };
}

function normalizeShapeType(rawType: string | undefined): ShapeType {
  const normalized = (rawType ?? "").toLowerCase();
  if (normalized.includes("text") || normalized.includes("shape") || normalized.includes("placeholder")) {
    return "TEXT";
  }
  if (normalized.includes("table")) {
    return "TABLE";
  }
  if (normalized.includes("image") || normalized.includes("picture")) {
    return "IMAGE";
  }
  if (normalized.includes("chart")) {
    return "CHART";
  }
  if (normalized.includes("smart")) {
    return "SMART_ART";
  }
  return "OTHER";
}

function normalizeColor(rawColor: string): string {
  const color = rawColor.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(color)) {
    return `#${color.replace("#", "").toUpperCase()}`;
  }
  return "#000000";
}

function normalizeLevel(rawLevel: number): 0 | 1 | 2 | 3 | 4 {
  if (rawLevel <= 0) {
    return 0;
  }
  if (rawLevel >= 4) {
    return 4;
  }

  return rawLevel as 0 | 1 | 2 | 3 | 4;
}
