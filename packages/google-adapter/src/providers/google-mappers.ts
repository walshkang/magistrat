import type {
  CellBorders,
  ChartSnapshot,
  DeckSnapshot,
  ImageMetadata,
  ParagraphAlignment,
  ShapeSnapshot,
  ShapeType,
  TableCellSnapshot,
  TableSnapshot,
  VerticalAlignment
} from "@magistrat/shared-types";
import type { GoogleBridgeChart, GoogleBridgePageElement, GoogleBridgePresentation, GoogleBridgeTable, GoogleBridgeTableCell } from "../bridge-types.js";

export function mapPresentationToDeckSnapshot(presentation: GoogleBridgePresentation): DeckSnapshot {
  const slides = [...presentation.slides]
    .sort((a, b) => a.index - b.index || a.slideId.localeCompare(b.slideId))
    .map((slide) => ({
      slideId: slide.slideId,
      index: slide.index,
      title: slide.title ?? "",
      slideWidth: slide.pageWidthPt ?? 720,
      slideHeight: slide.pageHeightPt ?? 405,
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

  const imageMetadata: ImageMetadata | undefined =
    shapeType === "IMAGE" &&
    typeof element.intrinsicWidthPx === "number" &&
    typeof element.intrinsicHeightPx === "number"
      ? {
          intrinsicWidth: element.intrinsicWidthPx * 0.75,
          intrinsicHeight: element.intrinsicHeightPx * 0.75,
          ...(element.imageMimeType ? { mimeType: element.imageMimeType } : {})
        }
      : undefined;

  return {
    objectId: element.objectId,
    name: element.name ?? "PageElement",
    shapeType,
    visible: element.visible ?? true,
    grouped: element.grouped ?? false,
    zIndex: element.zIndex ?? 0,
    ...(typeof element.fillColor === "string" ? { fillColor: normalizeColor(element.fillColor) } : {}),
    ...(typeof element.fillAlpha === "number" ? { fillAlpha: element.fillAlpha } : {}),
    ...(typeof element.lineColor === "string" ? { lineColor: normalizeColor(element.lineColor) } : {}),
    ...(typeof element.lineWidth === "number" && element.lineWidth > 0 ? { lineWidth: element.lineWidth } : {}),
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
    paragraphs: paragraphs.map((paragraph) => {
      const alignment = normalizeAlignment(paragraph.alignment);
      return {
        level: normalizeLevel(paragraph.level),
        text: paragraph.text,
        ...(typeof paragraph.bulletIndent === "number" ? { bulletIndent: paragraph.bulletIndent } : {}),
        ...(typeof paragraph.bulletHanging === "number" ? { bulletHanging: paragraph.bulletHanging } : {}),
        ...(typeof paragraph.lineSpacing === "number" ? { lineSpacing: paragraph.lineSpacing } : {}),
        ...(typeof paragraph.bulletGlyph === "string" ? { bulletGlyph: paragraph.bulletGlyph } : {}),
        ...(alignment ? { alignment } : {})
      };
    }),
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
    },
    ...(element.table ? { table: mapTable(element.table) } : {}),
    ...(imageMetadata ? { imageMetadata } : {}),
    ...(element.chart ? { chart: mapChart(element.chart) } : {})
  };
}

function mapChart(bridge: GoogleBridgeChart): ChartSnapshot {
  return {
    ...(bridge.chartType ? { chartType: bridge.chartType } : {}),
    series: bridge.series.map((s) => ({
      index: s.index,
      ...(s.color ? { color: normalizeColor(s.color) } : {}),
      ...(s.type ? { type: s.type } : {})
    })),
    axes: bridge.axes.map((a) => ({
      ...(a.position ? { position: a.position } : {}),
      ...(a.title ? { title: a.title } : {})
    })),
    ...(typeof bridge.hasDataLabels === "boolean" ? { hasDataLabels: bridge.hasDataLabels } : {}),
    ...(bridge.spreadsheetId ? { spreadsheetId: bridge.spreadsheetId } : {})
  };
}

function mapTable(bridge: GoogleBridgeTable): TableSnapshot {
  return {
    rows: bridge.rows,
    columns: bridge.columns,
    cells: bridge.cells.map(mapTableCell)
  };
}

function mapTableCell(cell: GoogleBridgeTableCell): TableCellSnapshot {
  return {
    rowIndex: cell.rowIndex,
    columnIndex: cell.columnIndex,
    ...(cell.fillColor ? { fillColor: normalizeColor(cell.fillColor) } : {}),
    ...(cell.borders ? { borders: mapCellBorders(cell.borders) } : {}),
    ...(normalizeAlignment(cell.textAlignment) ? { textAlignment: normalizeAlignment(cell.textAlignment)! } : {}),
    ...(normalizeVerticalAlignment(cell.verticalAlignment) ? { verticalAlignment: normalizeVerticalAlignment(cell.verticalAlignment)! } : {}),
    textRuns: (cell.textRuns ?? []).map((run) => ({
      text: run.text,
      fontFamily: run.fontFamily ?? "",
      fontSizePt: run.fontSizePt ?? 0,
      bold: run.bold ?? false,
      italic: run.italic ?? false,
      fontColor: normalizeColor(run.fontColor ?? "#000000"),
      fontAlpha: run.fontAlpha ?? 1,
      ...(run.proofingLanguage ? { proofingLanguage: run.proofingLanguage } : {})
    })),
    text: cell.text ?? ""
  };
}

function normalizeVerticalAlignment(raw: string | undefined): VerticalAlignment | undefined {
  if (!raw) return undefined;
  const n = raw.toUpperCase();
  if (n === "TOP") return "TOP";
  if (n === "MIDDLE") return "MIDDLE";
  if (n === "BOTTOM") return "BOTTOM";
  return undefined;
}

function mapCellBorders(borders: GoogleBridgeTableCell["borders"]): CellBorders {
  const result: CellBorders = {};
  for (const edge of ["top", "bottom", "left", "right"] as const) {
    const b = borders?.[edge];
    if (b) {
      result[edge] = {
        ...(b.color ? { color: normalizeColor(b.color) } : {}),
        ...(typeof b.width === "number" ? { width: b.width } : {})
      };
    }
  }
  return result;
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

function normalizeAlignment(raw: string | undefined): ParagraphAlignment | undefined {
  if (!raw) return undefined;
  const normalized = raw.toUpperCase();
  if (normalized === "LEFT" || normalized === "START") return "LEFT";
  if (normalized === "CENTER") return "CENTER";
  if (normalized === "RIGHT" || normalized === "END") return "RIGHT";
  if (normalized === "JUSTIFIED") return "JUSTIFIED";
  return undefined;
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
