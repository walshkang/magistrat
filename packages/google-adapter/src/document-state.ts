import type { DocumentStateV1 } from "@magistrat/shared-types";
import { getGoogleSlidesBridge } from "./bridge-types.js";

const STATE_START = "<!-- MAGISTRAT_STATE_V1_START -->";
const STATE_END = "<!-- MAGISTRAT_STATE_V1_END -->";

let inMemoryState: DocumentStateV1 | undefined;

export async function loadDocumentState(defaultState: DocumentStateV1): Promise<DocumentStateV1> {
  const bridge = getGoogleSlidesBridge();
  if (!bridge?.getDocumentCarrier) {
    inMemoryState = migrateLegacyState(inMemoryState ?? defaultState, defaultState);
    return inMemoryState;
  }

  try {
    const carrier = await bridge.getDocumentCarrier();
    const stateJson = extractStateJson(carrier);

    if (!stateJson) {
      inMemoryState = migrateLegacyState(inMemoryState ?? defaultState, defaultState);
      return inMemoryState;
    }

    const parsed = JSON.parse(stateJson) as unknown;
    const migrated = migrateLegacyState(parsed, defaultState);
    inMemoryState = migrated;
    return migrated;
  } catch {
    inMemoryState = inMemoryState ?? defaultState;
    return inMemoryState;
  }
}

export async function saveDocumentState(nextState: DocumentStateV1): Promise<void> {
  const normalizedState: DocumentStateV1 = {
    ...nextState,
    schemaVersion: 1,
    lastUpdatedIso: new Date().toISOString()
  };

  const bridge = getGoogleSlidesBridge();
  if (!bridge?.getDocumentCarrier || !bridge.setDocumentCarrier) {
    inMemoryState = normalizedState;
    return;
  }

  const carrier = await bridge.getDocumentCarrier();
  const nextCarrier = upsertStateBlock(carrier, JSON.stringify(normalizedState));
  await bridge.setDocumentCarrier(nextCarrier);
  inMemoryState = normalizedState;
}

export function createDefaultDocumentState(): DocumentStateV1 {
  return {
    schemaVersion: 1,
    lastUpdatedIso: new Date().toISOString(),
    findings: [],
    patchLog: []
  };
}

export function getDocumentIdentifier(): string {
  const bridge = getGoogleSlidesBridge();
  const fromHost = bridge?.getHostInfo?.().documentId;
  if (typeof fromHost === "string" && fromHost.length > 0) {
    return fromHost;
  }

  return "local-google-document";
}

function extractStateJson(carrier: string): string | undefined {
  const startIndex = carrier.indexOf(STATE_START);
  if (startIndex < 0) {
    return undefined;
  }

  const contentStart = startIndex + STATE_START.length;
  const endIndex = carrier.indexOf(STATE_END, contentStart);
  if (endIndex < 0) {
    return undefined;
  }

  return carrier.slice(contentStart, endIndex).trim();
}

function upsertStateBlock(carrier: string, json: string): string {
  const nextBlock = `${STATE_START}\n${json}\n${STATE_END}`;
  const startIndex = carrier.indexOf(STATE_START);

  if (startIndex < 0) {
    return carrier.length === 0 ? nextBlock : `${carrier}\n${nextBlock}`;
  }

  const endIndex = carrier.indexOf(STATE_END, startIndex + STATE_START.length);
  if (endIndex < 0) {
    return `${carrier.slice(0, startIndex)}${nextBlock}`;
  }

  const afterEnd = endIndex + STATE_END.length;
  return `${carrier.slice(0, startIndex)}${nextBlock}${carrier.slice(afterEnd)}`;
}

function migrateLegacyState(rawState: unknown, defaultState: DocumentStateV1): DocumentStateV1 {
  if (!rawState || typeof rawState !== "object") {
    return defaultState;
  }

  const state = rawState as DocumentStateV1 & {
    exemplar?: { mode?: string };
  };

  const normalizedMode = normalizeMode(state.exemplar?.mode);
  const exemplar = state.exemplar
    ? {
        ...state.exemplar,
        mode: normalizedMode
      }
    : undefined;

  const findings = Array.isArray(state.findings) ? state.findings : defaultState.findings;
  const notAnalyzedObjects = new Set(
    findings
      .filter((finding) => finding.coverage === "NOT_ANALYZED" && finding.objectId)
      .map((finding) => `${finding.slideId}:${finding.objectId}`)
  ).size;

  const coverage = state.coverage
    ? {
        ...state.coverage,
        notAnalyzedObjects:
          typeof state.coverage.notAnalyzedObjects === "number"
            ? state.coverage.notAnalyzedObjects
            : notAnalyzedObjects,
        continuityStatus: state.coverage.continuityStatus ?? "NOT_RUN",
        continuityCoverage: state.coverage.continuityStatus ? state.coverage.continuityCoverage : 0
      }
    : undefined;

  const baseState: DocumentStateV1 = {
    ...defaultState,
    ...state,
    findings
  };

  return {
    ...baseState,
    ...(exemplar ? { exemplar } : {}),
    ...(coverage ? { coverage } : {})
  };
}

function normalizeMode(mode: string | undefined): "original" | "token_normalized" {
  if (mode === "token_normalized") {
    return "token_normalized";
  }
  if (mode === "normalized") {
    return "token_normalized";
  }
  return "original";
}
