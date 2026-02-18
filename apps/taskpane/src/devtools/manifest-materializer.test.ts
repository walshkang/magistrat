import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADDIN_ID,
  findUnresolvedTemplateTokens,
  materializeManifestTemplate,
  normalizeHttpsOrigin
} from "./manifest-materializer.js";

const VALID_TEMPLATE = `
<OfficeApp>
  <Id>__ADDIN_ID__</Id>
  <DisplayName DefaultValue="__ADDIN_NAME__" />
  <AppDomain>__TASKPANE_ORIGIN__</AppDomain>
  <SourceLocation DefaultValue="__TASKPANE_ORIGIN__/index.html" />
</OfficeApp>
`;

describe("manifest materializer", () => {
  it("materializes all required tokens deterministically", () => {
    const result = materializeManifestTemplate({
      templateXml: VALID_TEMPLATE,
      origin: "https://demo.ngrok-free.app",
      addinName: "Magistrat & Partners"
    });

    expect(result.origin).toBe("https://demo.ngrok-free.app");
    expect(result.host).toBe("demo.ngrok-free.app");
    expect(result.addinId).toBe(DEFAULT_ADDIN_ID);
    expect(result.manifestXml).toContain("Magistrat &amp; Partners");
    expect(findUnresolvedTemplateTokens(result.manifestXml)).toEqual([]);
  });

  it("rejects non-https taskpane origins", () => {
    expect(() =>
      materializeManifestTemplate({
        templateXml: VALID_TEMPLATE,
        origin: "http://localhost:3010"
      })
    ).toThrow("HTTPS");
  });

  it("rejects origin values with path/query/hash", () => {
    expect(() => normalizeHttpsOrigin("https://demo.ngrok-free.app/path")).toThrow("origin only");
    expect(() => normalizeHttpsOrigin("https://demo.ngrok-free.app?x=1")).toThrow("origin only");
    expect(() => normalizeHttpsOrigin("https://demo.ngrok-free.app#hash")).toThrow("origin only");
  });

  it("fails when template includes unresolved tokens", () => {
    const withUnknownToken = `${VALID_TEMPLATE}<Foo>__SOMETHING_ELSE__</Foo>`;
    expect(() =>
      materializeManifestTemplate({
        templateXml: withUnknownToken,
        origin: "https://demo.ngrok-free.app"
      })
    ).toThrow("unresolved token");
  });

  it("fails when template is missing required tokens", () => {
    const missingTokenTemplate = VALID_TEMPLATE.replace("__ADDIN_NAME__", "Magistrat");
    expect(() =>
      materializeManifestTemplate({
        templateXml: missingTokenTemplate,
        origin: "https://demo.ngrok-free.app"
      })
    ).toThrow("missing required token __ADDIN_NAME__");
  });

  it("fails when add-in id is not a GUID", () => {
    expect(() =>
      materializeManifestTemplate({
        templateXml: VALID_TEMPLATE,
        origin: "https://demo.ngrok-free.app",
        addinId: "not-a-guid"
      })
    ).toThrow("GUID");
  });
});
