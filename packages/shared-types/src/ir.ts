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

export interface ShapeSnapshot {
  objectId: string;
  name: string;
  shapeType: ShapeType;
  visible: boolean;
  grouped: boolean;
  zIndex: number;
  textRuns: TextRunSnapshot[];
  paragraphs: ParagraphSnapshot[];
  geometry: GeometrySnapshot;
  inferredRole?: RoleV1 | undefined;
  inferredRoleScore?: number | undefined;
  supportedForAnalysis: boolean;
  autofitEnabled: boolean;
}

export interface SlideSnapshot {
  slideId: string;
  index: number;
  title: string;
  shapes: ShapeSnapshot[];
}

export interface DeckSnapshot {
  deckId: string;
  generatedAtIso: string;
  slides: SlideSnapshot[];
}
