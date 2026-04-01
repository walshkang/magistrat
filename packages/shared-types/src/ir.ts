import type { RoleV1 } from "./roles.js";

export type ShapeType = "TEXT" | "TABLE" | "IMAGE" | "CHART" | "SMART_ART" | "OTHER";

export interface TextRunSnapshot {
  text: string;
  fontFamily: string;
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  fontColor: string;
  fontAlpha: number;
  proofingLanguage?: string;
}

export type ParagraphAlignment = "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";

export interface ParagraphSnapshot {
  level: 0 | 1 | 2 | 3 | 4;
  bulletIndent?: number;
  bulletHanging?: number;
  bulletGlyph?: string;
  lineSpacing?: number;
  alignment?: ParagraphAlignment | undefined;
  text: string;
}

export interface GeometrySnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ShapeInspectability {
  typography: boolean;
  bullets: boolean;
}

export type VerticalAlignment = "TOP" | "MIDDLE" | "BOTTOM";

export interface CellBorders {
  top?: { color?: string; width?: number };
  bottom?: { color?: string; width?: number };
  left?: { color?: string; width?: number };
  right?: { color?: string; width?: number };
}

export interface CellMargins {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface TableCellSnapshot {
  rowIndex: number;
  columnIndex: number;
  /** Cell background fill color, hex #RRGGBB */
  fillColor?: string;
  borders?: CellBorders;
  margins?: CellMargins;
  /** Horizontal text alignment within the cell */
  textAlignment?: ParagraphAlignment;
  /** Vertical alignment of content within the cell */
  verticalAlignment?: VerticalAlignment;
  /** All text runs within this cell */
  textRuns: TextRunSnapshot[];
  /** Raw concatenated text content */
  text: string;
}

export interface TableSnapshot {
  rows: number;
  columns: number;
  cells: TableCellSnapshot[];
}

export interface ShapeSnapshot {
  objectId: string;
  name: string;
  shapeType: ShapeType;
  visible: boolean;
  grouped: boolean;
  zIndex: number;
  /** Shape fill (e.g. callout background); from host when available */
  fillColor?: string | undefined;
  fillAlpha?: number | undefined;
  /** Shape border/outline color when present; hex #RRGGBB */
  lineColor?: string | undefined;
  /** Shape border/outline width in points; 0 or absent = no border */
  lineWidth?: number | undefined;
  textRuns: TextRunSnapshot[];
  paragraphs: ParagraphSnapshot[];
  geometry: GeometrySnapshot;
  inferredRole?: RoleV1 | undefined;
  inferredRoleScore?: number | undefined;
  supportedForAnalysis: boolean;
  autofitEnabled: boolean;
  inspectability: ShapeInspectability;
  /** Table cell data when shapeType === "TABLE" */
  table?: TableSnapshot | undefined;
}

export interface SlideSnapshot {
  slideId: string;
  index: number;
  title: string;
  /** Slide canvas width in points */
  slideWidth: number;
  /** Slide canvas height in points */
  slideHeight: number;
  shapes: ShapeSnapshot[];
}

export interface DeckSnapshot {
  deckId: string;
  generatedAtIso: string;
  /** When true, host provided master/layout metadata (v1: BP-MASTERS-001 skips when set) */
  masterLayoutMetadataAvailable?: boolean;
  slides: SlideSnapshot[];
}
