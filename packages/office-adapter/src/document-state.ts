import type { DocumentStateV1 } from "@magistrat/shared-types";

const STATE_POINTER_KEY = "magistrat_state_pointer_v1";
const STATE_XML_ROOT = "magistratState";

interface AsyncResultLike<T> {
  status: "succeeded" | "failed";
  value?: T;
  error?: { message?: string };
}

interface CustomXmlPartLike {
  id: string;
  getXmlAsync(callback: (result: AsyncResultLike<string>) => void): void;
  deleteAsync(callback: (result: AsyncResultLike<void>) => void): void;
}

interface CustomXmlPartsLike {
  addAsync(xml: string, callback: (result: AsyncResultLike<CustomXmlPartLike>) => void): void;
  getByIdAsync(id: string, callback: (result: AsyncResultLike<CustomXmlPartLike>) => void): void;
}

interface SettingsLike {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  saveAsync(callback: (result: AsyncResultLike<void>) => void): void;
}

interface DocumentLike {
  settings?: SettingsLike;
  customXmlParts?: CustomXmlPartsLike;
  url?: string;
}

let inMemoryState: DocumentStateV1 | undefined;

export async function loadDocumentState(defaultState: DocumentStateV1): Promise<DocumentStateV1> {
  const documentLike = getDocumentLike();
  if (!documentLike?.settings || !documentLike.customXmlParts) {
    inMemoryState = inMemoryState ?? defaultState;
    return inMemoryState;
  }

  const pointerRaw = documentLike.settings.get(STATE_POINTER_KEY);
  if (typeof pointerRaw !== "string" || pointerRaw.length === 0) {
    inMemoryState = inMemoryState ?? defaultState;
    return inMemoryState;
  }

  try {
    const part = await getCustomXmlPart(documentLike.customXmlParts, pointerRaw);
    if (!part) {
      inMemoryState = inMemoryState ?? defaultState;
      return inMemoryState;
    }

    const xml = await getCustomXml(part);
    const json = extractJsonFromXml(xml);
    const parsed = JSON.parse(json) as DocumentStateV1;
    inMemoryState = parsed;
    return parsed;
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

  const documentLike = getDocumentLike();
  if (!documentLike?.settings || !documentLike.customXmlParts) {
    inMemoryState = normalizedState;
    return;
  }

  const previousPointer = documentLike.settings.get(STATE_POINTER_KEY);
  const xml = wrapJsonInXml(JSON.stringify(normalizedState));

  const addedPart = await addCustomXmlPart(documentLike.customXmlParts, xml);
  documentLike.settings.set(STATE_POINTER_KEY, addedPart.id);
  await saveSettings(documentLike.settings);

  if (typeof previousPointer === "string" && previousPointer.length > 0) {
    const previousPart = await getCustomXmlPart(documentLike.customXmlParts, previousPointer);
    if (previousPart) {
      await deleteCustomXmlPart(previousPart);
    }
  }

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
  const documentLike = getDocumentLike();
  if (documentLike?.url) {
    return documentLike.url;
  }
  return "local-document";
}

function getDocumentLike(): DocumentLike | undefined {
  const officeGlobal = (globalThis as { Office?: { context?: { document?: DocumentLike } } }).Office;
  return officeGlobal?.context?.document;
}

async function addCustomXmlPart(customXmlParts: CustomXmlPartsLike, xml: string): Promise<CustomXmlPartLike> {
  return new Promise((resolve, reject) => {
    customXmlParts.addAsync(xml, (result) => {
      if (result.status === "succeeded" && result.value) {
        resolve(result.value);
        return;
      }
      reject(new Error(result.error?.message ?? "addAsync failed"));
    });
  });
}

async function getCustomXmlPart(
  customXmlParts: CustomXmlPartsLike,
  id: string
): Promise<CustomXmlPartLike | undefined> {
  return new Promise((resolve, reject) => {
    customXmlParts.getByIdAsync(id, (result) => {
      if (result.status === "failed") {
        reject(new Error(result.error?.message ?? "getByIdAsync failed"));
        return;
      }
      resolve(result.value);
    });
  });
}

async function getCustomXml(part: CustomXmlPartLike): Promise<string> {
  return new Promise((resolve, reject) => {
    part.getXmlAsync((result) => {
      if (result.status === "succeeded" && typeof result.value === "string") {
        resolve(result.value);
        return;
      }
      reject(new Error(result.error?.message ?? "getXmlAsync failed"));
    });
  });
}

async function deleteCustomXmlPart(part: CustomXmlPartLike): Promise<void> {
  return new Promise((resolve, reject) => {
    part.deleteAsync((result) => {
      if (result.status === "succeeded") {
        resolve();
        return;
      }
      reject(new Error(result.error?.message ?? "deleteAsync failed"));
    });
  });
}

async function saveSettings(settings: SettingsLike): Promise<void> {
  return new Promise((resolve, reject) => {
    settings.saveAsync((result) => {
      if (result.status === "succeeded") {
        resolve();
        return;
      }
      reject(new Error(result.error?.message ?? "settings.saveAsync failed"));
    });
  });
}

function wrapJsonInXml(json: string): string {
  const escaped = json.replaceAll("]]>", "]]]]><![CDATA[>");
  return `<${STATE_XML_ROOT}><![CDATA[${escaped}]]></${STATE_XML_ROOT}>`;
}

function extractJsonFromXml(xml: string): string {
  const regex = new RegExp(`<${STATE_XML_ROOT}><!\\[CDATA\\[(.*)\\]\\]><\\/${STATE_XML_ROOT}>`, "s");
  const match = xml.match(regex);
  if (!match || !match[1]) {
    throw new Error("Invalid Magistrat state XML");
  }
  return match[1];
}
