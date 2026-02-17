import type { DeckSnapshot, DocumentStateV1, PatchOp, PatchRecord } from "@magistrat/shared-types";
import {
  createDefaultDocumentState,
  getDocumentIdentifier,
  loadDocumentState as loadDocumentStateInternal,
  saveDocumentState as saveDocumentStateInternal
} from "./document-state.js";
import { stableTargetFingerprint } from "./target-fingerprint.js";

export interface HostCapabilities {
  host: "powerpoint" | "unknown";
  platform: "pc" | "mac" | "web" | "unknown";
  officeAvailable: boolean;
  desktopSupported: boolean;
}

export async function readDeckSnapshot(): Promise<DeckSnapshot> {
  const now = new Date().toISOString();
  const deckId = getDocumentIdentifier();

  return {
    deckId,
    generatedAtIso: now,
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
}

export async function applyPatchOps(patchOps: PatchOp[]): Promise<PatchRecord[]> {
  const appliedAtIso = new Date().toISOString();
  return patchOps.map((patch) => ({
    id: patch.id,
    findingId: `finding-for-${patch.id}`,
    targetFingerprint: patch.target,
    before: {},
    after: patch.fields,
    reconcileState: "applied",
    appliedAtIso
  }));
}

export async function selectObject(_slideId: string, _objectId: string): Promise<boolean> {
  void _slideId;
  void _objectId;
  return true;
}

export async function loadDocumentState(): Promise<DocumentStateV1> {
  return loadDocumentStateInternal(createDefaultDocumentState());
}

export async function saveDocumentState(nextState: DocumentStateV1): Promise<void> {
  await saveDocumentStateInternal(nextState);
}

export function getHostCapabilities(): HostCapabilities {
  const officeGlobal = (
    globalThis as unknown as { Office?: { context?: { host?: string; platform?: string } } }
  ).Office;
  const hostRaw = officeGlobal?.context?.host?.toLowerCase();
  const platformRaw = officeGlobal?.context?.platform?.toLowerCase();

  const host = hostRaw?.includes("powerpoint") ? "powerpoint" : "unknown";
  let platform: HostCapabilities["platform"] = "unknown";

  if (platformRaw?.includes("pc") || platformRaw?.includes("win")) {
    platform = "pc";
  } else if (platformRaw?.includes("mac")) {
    platform = "mac";
  } else if (platformRaw?.includes("officeonline") || platformRaw?.includes("web")) {
    platform = "web";
  }

  const desktopSupported = host === "powerpoint" && (platform === "pc" || platform === "mac");

  return {
    host,
    platform,
    officeAvailable: Boolean(officeGlobal),
    desktopSupported
  };
}

export { createDefaultDocumentState as createInitialDocumentState, stableTargetFingerprint };
