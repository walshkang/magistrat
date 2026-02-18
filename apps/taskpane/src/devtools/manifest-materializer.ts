export const DEFAULT_ADDIN_ID = "6a851724-5793-448c-b65f-19d3004f0b16";
export const DEFAULT_ADDIN_NAME = "Magistrat (Local)";

const REQUIRED_TOKENS = ["__TASKPANE_ORIGIN__", "__ADDIN_ID__", "__ADDIN_NAME__"] as const;
const TEMPLATE_TOKEN_PATTERN = /__[A-Z0-9_]+__/g;
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MaterializeManifestTemplateOptions {
  templateXml: string;
  origin: string;
  addinId?: string;
  addinName?: string;
}

export interface MaterializeManifestTemplateResult {
  manifestXml: string;
  origin: string;
  host: string;
  addinId: string;
  addinName: string;
}

export function materializeManifestTemplate(
  options: MaterializeManifestTemplateOptions
): MaterializeManifestTemplateResult {
  assertRequiredTokensPresent(options.templateXml);

  const { origin, host } = normalizeHttpsOrigin(options.origin);
  const addinId = normalizeAddinId(options.addinId ?? DEFAULT_ADDIN_ID);
  const addinName = normalizeAddinName(options.addinName ?? DEFAULT_ADDIN_NAME);

  const tokenValues: Record<(typeof REQUIRED_TOKENS)[number], string> = {
    __TASKPANE_ORIGIN__: origin,
    __ADDIN_ID__: addinId,
    __ADDIN_NAME__: escapeXmlAttribute(addinName)
  };

  let rendered = options.templateXml;
  for (const token of REQUIRED_TOKENS) {
    rendered = rendered.split(token).join(tokenValues[token]);
  }

  const unresolvedTokens = findUnresolvedTemplateTokens(rendered);
  if (unresolvedTokens.length > 0) {
    throw new Error(`Manifest template contains unresolved token(s): ${unresolvedTokens.join(", ")}.`);
  }

  return {
    manifestXml: rendered,
    origin,
    host,
    addinId,
    addinName
  };
}

export function normalizeHttpsOrigin(value: string): { origin: string; host: string } {
  const raw = value.trim();
  if (raw.length === 0) {
    throw new Error("TASKPANE_ORIGIN must be a non-empty HTTPS origin.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`TASKPANE_ORIGIN must be a valid URL origin. Received: ${value}`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`TASKPANE_ORIGIN must use HTTPS. Received protocol: ${url.protocol}`);
  }

  if (url.pathname !== "/" || url.search.length > 0 || url.hash.length > 0) {
    throw new Error("TASKPANE_ORIGIN must be an origin only (no path, query, or hash).");
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error("TASKPANE_ORIGIN must not include credentials.");
  }

  return {
    origin: url.origin,
    host: url.host
  };
}

export function normalizeAddinId(value: string): string {
  const normalized = value.trim();
  if (!GUID_PATTERN.test(normalized)) {
    throw new Error(`Add-in id must be a GUID. Received: ${value}`);
  }
  return normalized.toLowerCase();
}

export function normalizeAddinName(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error("Add-in name must be non-empty.");
  }
  return normalized;
}

export function findUnresolvedTemplateTokens(xml: string): string[] {
  const matches = xml.match(TEMPLATE_TOKEN_PATTERN) ?? [];
  return [...new Set(matches)].sort();
}

function assertRequiredTokensPresent(templateXml: string): void {
  for (const token of REQUIRED_TOKENS) {
    if (!templateXml.includes(token)) {
      throw new Error(`Manifest template is missing required token ${token}.`);
    }
  }
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
