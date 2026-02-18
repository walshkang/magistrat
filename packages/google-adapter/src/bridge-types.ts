import type { PatchOp } from "@magistrat/shared-types";

export interface GoogleHostInfo {
  host?: "google_slides" | "unknown";
  platform?: "web" | "unknown";
  documentId?: string;
}

export interface GoogleBridgeCapabilities {
  readDeckSnapshot?: boolean;
  applyPatchOps?: boolean;
  selectObject?: boolean;
  documentStateCarrier?: boolean;
  revisionGuard?: boolean;
}

export interface GoogleBridgeTextRun {
  text: string;
  fontFamily?: string;
  fontSizePt?: number;
  bold?: boolean;
  italic?: boolean;
  fontColor?: string;
  fontAlpha?: number;
  proofingLanguage?: string;
}

export interface GoogleBridgeParagraph {
  level: number;
  bulletIndent?: number;
  bulletHanging?: number;
  bulletGlyph?: string;
  lineSpacing?: number;
  text: string;
}

export interface GoogleBridgePageElement {
  objectId: string;
  name?: string;
  elementType?: string;
  visible?: boolean;
  grouped?: boolean;
  zIndex?: number;
  geometry?: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    rotation?: number;
  };
  text?: {
    runs?: GoogleBridgeTextRun[];
    paragraphs?: GoogleBridgeParagraph[];
    inspectability?: {
      typography?: boolean;
      bullets?: boolean;
    };
    autofitEnabled?: boolean;
  };
}

export interface GoogleBridgeSlide {
  slideId: string;
  index: number;
  title?: string;
  pageElements: GoogleBridgePageElement[];
}

export interface GoogleBridgePresentation {
  documentId: string;
  revisionId?: string;
  slides: GoogleBridgeSlide[];
}

export interface BridgeMutation {
  patchId: string;
  op: PatchOp["op"];
  slideId: string;
  objectId: string;
  fields: Record<string, unknown>;
}

export interface BridgeApplyResult {
  revisionId?: string;
}

export interface GoogleSlidesBridge {
  getHostInfo?(): GoogleHostInfo;
  getCapabilities?(): GoogleBridgeCapabilities;
  readPresentation(): Promise<GoogleBridgePresentation>;
  // SAFE mode may invoke this multiple times per apply request when chunking writes.
  applyMutations?(mutations: BridgeMutation[], options: { requiredRevisionId?: string }): Promise<BridgeApplyResult>;
  getDocumentCarrier?(): Promise<string>;
  setDocumentCarrier?(content: string): Promise<void>;
  selectObject?(slideId: string, objectId: string): Promise<boolean>;
}

export function getGoogleSlidesBridge(): GoogleSlidesBridge | undefined {
  const globalValue = globalThis as unknown as {
    __MAGISTRAT_GOOGLE_BRIDGE__?: GoogleSlidesBridge;
  };
  return globalValue.__MAGISTRAT_GOOGLE_BRIDGE__;
}

export function setGoogleSlidesBridgeForTests(bridge: GoogleSlidesBridge | undefined): void {
  const globalValue = globalThis as unknown as {
    __MAGISTRAT_GOOGLE_BRIDGE__?: GoogleSlidesBridge;
  };

  if (!bridge) {
    delete globalValue.__MAGISTRAT_GOOGLE_BRIDGE__;
    return;
  }

  globalValue.__MAGISTRAT_GOOGLE_BRIDGE__ = bridge;
}
