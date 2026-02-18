import type { DeckSnapshot, PatchOp, ShapeSnapshot, ShapeType } from "@magistrat/shared-types";
import type {
  AdapterCapabilityRegistry,
  AdapterProvider,
  AdapterRuntimeStatus,
  HostCapabilities
} from "../adapter-types.js";

interface OfficeReadonlyProviderOptions {
  getDocumentIdentifier: () => string;
  hostCapabilities: HostCapabilities;
  capabilityRegistry: AdapterCapabilityRegistry;
}

interface ContextLike {
  sync(): Promise<void>;
  presentation?: {
    slides?: SlideCollectionLike;
  };
}

interface SlideCollectionLike {
  items?: SlideLike[];
  load(select: string): void;
}

interface SlideLike {
  id?: string;
  index?: number;
  title?: string;
  shapes: ShapeCollectionLike;
  load(select: string): void;
}

interface ShapeCollectionLike {
  items?: ShapeLike[];
  load(select: string): void;
}

interface ShapeLike {
  id?: string;
  name?: string;
  type?: string | number;
  visible?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zOrderPosition?: number;
  textFrame?: TextFrameLike;
  load(select: string): void;
}

interface TextFrameLike {
  hasText?: boolean;
  autoSizeSetting?: string | number;
  textRange?: TextRangeLike;
  load(select: string): void;
}

interface TextRangeLike {
  text?: string;
  font?: FontLike;
  load(select: string): void;
}

interface FontLike {
  name?: string | null;
  size?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  color?: string | null;
}

interface ShapeEntry {
  slide: SlideLike;
  shape: ShapeLike;
  shapeIndex: number;
}

const CHUNK_SIZE = 50;
const APPLY_REASON = "Patch application is disabled in OFFICE_READONLY mode for the Office parity track.";
const SELECT_REASON = "Object selection is deferred in OFFICE_READONLY mode.";

export function createOfficeReadonlyProvider(options: OfficeReadonlyProviderOptions): AdapterProvider {
  const runtimeStatus: AdapterRuntimeStatus = {
    mode: "OFFICE_READONLY",
    hostCapabilities: options.hostCapabilities,
    capabilities: {
      readDeckSnapshot: { supported: true },
      applyPatchOps: {
        supported: false,
        reasonCode: "POLICY_DISABLED",
        reason: APPLY_REASON
      },
      selectObject: {
        supported: false,
        reasonCode: "POLICY_DISABLED",
        reason: SELECT_REASON
      }
    },
    capabilityRegistry: options.capabilityRegistry
  };

  return {
    getRuntimeStatus: () => runtimeStatus,
    readDeckSnapshot: async () => readDeckSnapshot(options),
    applyPatchOps: async (_patchOps: PatchOp[]) => notSupported("applyPatchOps", APPLY_REASON),
    selectObject: async (_slideId: string, _objectId: string) => notSupported("selectObject", SELECT_REASON)
  };
}

async function readDeckSnapshot(options: OfficeReadonlyProviderOptions): Promise<DeckSnapshot> {
  const run = getPowerPointRun();
  if (!run) {
    throw new Error("PowerPoint.run is unavailable.");
  }

  return run(async (contextRaw: unknown) => {
    const context = contextRaw as ContextLike;
    const slidesCollection = context.presentation?.slides;
    if (!slidesCollection) {
      throw new Error("PowerPoint presentation slides API is unavailable.");
    }

    slidesCollection.load("items");
    await context.sync();

    const slides = slidesCollection.items ?? [];
    for (const slide of slides) {
      slide.load("id,index,title");
      slide.shapes.load("items");
    }
    await context.sync();

    const entries: ShapeEntry[] = [];
    const shapesBySlide = new Map<SlideLike, ShapeSnapshot[]>();
    for (const slide of slides) {
      const slideShapes = slide.shapes.items ?? [];
      shapesBySlide.set(slide, []);
      for (let index = 0; index < slideShapes.length; index += 1) {
        const shape = slideShapes[index];
        if (shape) {
          entries.push({ slide, shape, shapeIndex: index });
        }
      }
    }

    for (let start = 0; start < entries.length; start += CHUNK_SIZE) {
      const chunk = entries.slice(start, start + CHUNK_SIZE);
      for (const entry of chunk) {
        entry.shape.load("id,name,type,visible,left,top,width,height,rotation,zOrderPosition");
        const textFrame = entry.shape.textFrame;
        if (textFrame) {
          textFrame.load("hasText,autoSizeSetting");
          textFrame.textRange?.load("text,font/name,font/size,font/bold,font/italic,font/color");
        }
      }
      await context.sync();

      for (const entry of chunk) {
        const shapeSnapshot = mapShape(entry);
        const slideShapes = shapesBySlide.get(entry.slide);
        if (slideShapes) {
          slideShapes.push(shapeSnapshot);
        }
      }
    }

    return {
      deckId: options.getDocumentIdentifier(),
      generatedAtIso: new Date().toISOString(),
      slides: slides.map((slide, index) => ({
        slideId: valueOr(slide.id, `slide-${index + 1}`),
        index: typeof slide.index === "number" ? slide.index : index + 1,
        title: valueOr(slide.title, ""),
        shapes: shapesBySlide.get(slide) ?? []
      }))
    };
  });
}

function mapShape(entry: ShapeEntry): ShapeSnapshot {
  const shapeType = normalizeShapeType(entry.shape.type);
  const supportedForAnalysis = shapeType === "TEXT";
  const textFrame = entry.shape.textFrame;
  const hasText = Boolean(textFrame?.hasText);
  const textRange = hasText ? textFrame?.textRange : undefined;
  const rawText = valueOr(textRange?.text, "");
  const font = textRange?.font;
  const fontFamily = typeof font?.name === "string" ? font.name : "";
  const fontSizePt = typeof font?.size === "number" ? font.size : 0;
  const bold = typeof font?.bold === "boolean" ? font.bold : false;
  const italic = typeof font?.italic === "boolean" ? font.italic : false;
  const fontColorRaw = typeof font?.color === "string" ? font.color : "#000000";

  const typographyInspectable =
    fontFamily.length > 0 &&
    typeof font?.size === "number" &&
    typeof font?.bold === "boolean" &&
    typeof font?.italic === "boolean" &&
    typeof font?.color === "string";

  const textRuns =
    hasText && rawText.length > 0
      ? [
          {
            text: rawText,
            fontFamily: typographyInspectable ? fontFamily : "",
            fontSizePt: typographyInspectable ? fontSizePt : 0,
            bold: typographyInspectable ? bold : false,
            italic: typographyInspectable ? italic : false,
            fontColor: normalizeColor(typographyInspectable ? fontColorRaw : "#000000"),
            fontAlpha: 1
          }
        ]
      : [];

  return {
    objectId: valueOr(entry.shape.id, `${valueOr(entry.slide.id, "slide")}-shape-${entry.shapeIndex + 1}`),
    name: valueOr(entry.shape.name, "Shape"),
    shapeType,
    visible: booleanOr(entry.shape.visible, true),
    grouped: false,
    zIndex: typeof entry.shape.zOrderPosition === "number" ? entry.shape.zOrderPosition : entry.shapeIndex + 1,
    textRuns,
    paragraphs:
      hasText && rawText.length > 0
        ? [
            {
              level: 0,
              text: rawText
            }
          ]
        : [],
    geometry: {
      left: numberOr(entry.shape.left, 0),
      top: numberOr(entry.shape.top, 0),
      width: numberOr(entry.shape.width, 0),
      height: numberOr(entry.shape.height, 0),
      rotation: numberOr(entry.shape.rotation, 0)
    },
    supportedForAnalysis,
    autofitEnabled: parseAutofit(textFrame?.autoSizeSetting),
    inspectability: {
      typography: supportedForAnalysis ? typographyInspectable : false,
      bullets: false
    }
  };
}

function normalizeShapeType(rawType: string | number | undefined): ShapeType {
  if (typeof rawType === "string") {
    const normalized = rawType.toLowerCase();
    if (normalized.includes("text") || normalized.includes("placeholder")) {
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
  }
  return "OTHER";
}

function normalizeColor(raw: string): string {
  const normalized = raw.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(normalized)) {
    return `#${normalized.replace("#", "").toUpperCase()}`;
  }
  return "#000000";
}

function parseAutofit(raw: string | number | undefined): boolean {
  if (typeof raw === "number") {
    return raw !== 0;
  }
  if (typeof raw !== "string") {
    return false;
  }
  return !raw.toLowerCase().includes("none");
}

function valueOr(value: string | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function booleanOr(value: boolean | undefined, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function getPowerPointRun():
  | ((callback: (context: unknown) => Promise<DeckSnapshot>) => Promise<DeckSnapshot>)
  | undefined {
  const powerPointGlobal = (
    globalThis as unknown as {
      PowerPoint?: {
        run?: (callback: (context: unknown) => Promise<DeckSnapshot>) => Promise<DeckSnapshot>;
      };
    }
  ).PowerPoint;

  const run = powerPointGlobal?.run;
  if (typeof run !== "function") {
    return undefined;
  }
  return run.bind(powerPointGlobal);
}

function notSupported<T>(action: string, reason: string): Promise<T> {
  return Promise.reject(new Error(`${action} not supported: ${reason}`));
}
