import type {
  CandidateRule,
  CandidateRuleProperty,
  InferCandidateRulesResult,
  RoleV1,
  RoleStyleTokens,
  StyleMap
} from "@magistrat/shared-types";
import { ROLE_V1_VALUES } from "@magistrat/shared-types";
import { stableHash } from "./hash.js";

/**
 * Merge exemplar StyleMaps: primary wins per role; additional maps fill roles missing from primary.
 * Does not mutate inputs.
 */
export function mergeStyleMaps(primary: StyleMap, ...additional: StyleMap[]): StyleMap {
  const result: StyleMap = { ...primary };
  for (const roleKey of ROLE_V1_VALUES) {
    if (roleKey === "UNKNOWN") continue;
    if (result[roleKey]) continue;
    for (const map of additional) {
      const tokens = map[roleKey];
      if (tokens) {
        result[roleKey] = tokens;
        break;
      }
    }
  }
  return result;
}

/**
 * Infer candidate rules from an exemplar's style map.
 * Each detected pattern becomes a confirmable rule.
 */
export function inferCandidateRules(styleMap: StyleMap): InferCandidateRulesResult {
  const candidates: CandidateRule[] = [];

  for (const roleKey of ROLE_V1_VALUES) {
    if (roleKey === "UNKNOWN") continue;
    const tokens = styleMap[roleKey];
    if (!tokens) continue;

    candidates.push(...inferTypographyRules(roleKey, tokens));
    candidates.push(...inferBulletRules(roleKey, tokens));
    candidates.push(...inferColorRules(roleKey, tokens));
    candidates.push(...inferLayoutRules(roleKey, tokens));
  }

  return { candidates };
}

function inferTypographyRules(role: RoleV1, tokens: RoleStyleTokens): CandidateRule[] {
  const rules: CandidateRule[] = [];

  rules.push(
    makeCandidate(role, "fontFamily", tokens.fontFamily, `${formatRole(role)} font: ${tokens.fontFamily}`)
  );

  rules.push(
    makeCandidate(role, "fontSizePt", tokens.fontSizePt, `${formatRole(role)} size: ${tokens.fontSizePt}pt`)
  );

  rules.push(
    makeCandidate(
      role,
      "bold",
      tokens.bold,
      `${formatRole(role)} weight: ${tokens.bold ? "bold" : "regular"}`
    )
  );

  rules.push(
    makeCandidate(
      role,
      "italic",
      tokens.italic,
      `${formatRole(role)} style: ${tokens.italic ? "italic" : "upright"}`
    )
  );

  if (tokens.lineSpacing !== undefined) {
    rules.push(
      makeCandidate(
        role,
        "lineSpacing",
        tokens.lineSpacing,
        `${formatRole(role)} line spacing: ${tokens.lineSpacing}×`
      )
    );
  }

  if (tokens.alignment !== undefined) {
    rules.push(
      makeCandidate(
        role,
        "alignment",
        tokens.alignment,
        `${formatRole(role)} text alignment: ${tokens.alignment}`
      )
    );
  }

  return rules;
}

function inferBulletRules(role: RoleV1, tokens: RoleStyleTokens): CandidateRule[] {
  const rules: CandidateRule[] = [];

  if (tokens.bulletIndent !== undefined) {
    rules.push(
      makeCandidate(
        role,
        "bulletIndent",
        { indent: tokens.bulletIndent, hanging: tokens.bulletHanging },
        `${formatRole(role)} indent: ${tokens.bulletIndent}pt` +
          (tokens.bulletHanging !== undefined ? `, hanging ${tokens.bulletHanging}pt` : "")
      )
    );
  }

  if (tokens.bulletGlyph !== undefined) {
    rules.push(
      makeCandidate(
        role,
        "bulletGlyph",
        tokens.bulletGlyph,
        `${formatRole(role)} bullet: "${tokens.bulletGlyph}"`
      )
    );
  }

  return rules;
}

function inferColorRules(role: RoleV1, tokens: RoleStyleTokens): CandidateRule[] {
  const rules: CandidateRule[] = [];

  rules.push(
    makeCandidate(role, "fontColor", tokens.fontColor, `${formatRole(role)} color: ${tokens.fontColor}`)
  );

  if (role === "CALLOUT" && tokens.fillColor !== undefined) {
    rules.push(
      makeCandidate(role, "fillColor", tokens.fillColor, `Callout fill: ${tokens.fillColor}`)
    );
  }

  return rules;
}

function inferLayoutRules(role: RoleV1, tokens: RoleStyleTokens): CandidateRule[] {
  const rules: CandidateRule[] = [];

  if (tokens.hasGeometryCluster && tokens.geometryCentroid) {
    const cx = Math.round(tokens.geometryCentroid.x);
    const cy = Math.round(tokens.geometryCentroid.y);
    rules.push(
      makeCandidate(
        role,
        "geometryBand",
        tokens.geometryCentroid,
        `${formatRole(role)} position band: center ~(${cx}, ${cy})pt`
      )
    );
  }

  return rules;
}

function makeCandidate(
  role: RoleV1,
  property: CandidateRuleProperty,
  observedValue: unknown,
  label: string
): CandidateRule {
  return {
    id: `candidate-${stableHash([role, property])}`,
    role,
    property,
    label,
    observedValue,
    enabled: true
  };
}

function formatRole(role: RoleV1): string {
  const map: Record<string, string> = {
    TITLE: "Title",
    SUBTITLE: "Subtitle",
    BODY: "Body",
    BULLET_L1: "Bullet L1",
    BULLET_L2: "Bullet L2",
    FOOTER: "Footer",
    CALLOUT: "Callout"
  };
  return map[role] ?? role;
}
