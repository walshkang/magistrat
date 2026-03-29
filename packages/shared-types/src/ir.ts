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

export interface ParagraphSnapshot {
  level: 0 | 1 | 2 | 3 | 4;
  bulletIndent?: number;
  bulletHanging?: number;
  bulletGlyph?: string;
  lineSpacing?: number;
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
  textRuns: TextRunSnapshot[];
  paragraphs: ParagraphSnapshot[];
  geometry: GeometrySnapshot;
  inferredRole?: RoleV1 | undefined;
  inferredRoleScore?: number | undefined;
  supportedForAnalysis: boolean;
  autofitEnabled: boolean;
  inspectability: ShapeInspectability;
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
