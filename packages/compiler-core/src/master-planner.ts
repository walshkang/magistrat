import type { RoleV1, StyleMap, RoleStyleTokens } from "@magistrat/shared-types";

// ── Slides API request types (minimal subset for batchUpdate) ──

export interface SlidesApiColor {
  red: number;
  green: number;
  blue: number;
}

export interface SlidesApiRequest {
  updateTextStyle?: {
    objectId: string;
    style: {
      fontFamily?: string;
      fontSize?: { magnitude: number; unit: "PT" };
      bold?: boolean;
      italic?: boolean;
      foregroundColor?: { opaqueColor: { rgbColor: SlidesApiColor } };
    };
    fields: string;
  };
  updateParagraphStyle?: {
    objectId: string;
    style: {
      lineSpacing?: number;
    };
    fields: string;
  };
  updateShapeProperties?: {
    objectId: string;
    shapeProperties: {
      shapeBackgroundFill?: {
        solidFill: { color: { rgbColor: SlidesApiColor } };
      };
    };
    fields: string;
  };
}

// ── Master/layout snapshot types (from bridge) ──

export interface MasterLayoutPlaceholder {
  objectId: string;
  placeholderType: string;
}

export interface MasterLayoutPage {
  objectId: string;
  pageType: "master" | "layout";
  /** Layout name, e.g. "Title Slide", "Section Header" */
  name?: string;
  placeholders: MasterLayoutPlaceholder[];
}

export interface MasterLayoutSnapshot {
  pages: MasterLayoutPage[];
}

// ── Plan output ──

export interface MasterPatchMatch {
  role: RoleV1;
  placeholderObjectId: string;
  pageObjectId: string;
  pageType: "master" | "layout";
}

export interface MasterPatchSkip {
  placeholderType: string;
  placeholderObjectId: string;
  pageObjectId: string;
  reason: string;
}

export interface MasterPatchPlan {
  requests: SlidesApiRequest[];
  matched: MasterPatchMatch[];
  skipped: MasterPatchSkip[];
}

// ── Placeholder type → Role mapping ──

const PLACEHOLDER_TO_ROLE: Record<string, RoleV1> = {
  TITLE: "TITLE",
  CENTERED_TITLE: "TITLE",
  SUBTITLE: "SUBTITLE",
  BODY: "BODY",
  OBJECT: "BODY",
  SLIDE_NUMBER: "FOOTER",
  FOOTER: "FOOTER",
  DATE_HEADER: "FOOTER",
};

/** Convert hex #RRGGBB to Slides API float RGB (0–1 range). */
function hexToApiColor(hex: string): SlidesApiColor {
  const clean = hex.replace("#", "");
  return {
    red: parseInt(clean.substring(0, 2), 16) / 255,
    green: parseInt(clean.substring(2, 4), 16) / 255,
    blue: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

function buildTextStyleRequests(
  objectId: string,
  tokens: RoleStyleTokens
): SlidesApiRequest[] {
  const fields: string[] = [];
  const style: NonNullable<SlidesApiRequest["updateTextStyle"]>["style"] = {};

  style.fontFamily = tokens.fontFamily;
  fields.push("fontFamily");

  style.fontSize = { magnitude: tokens.fontSizePt, unit: "PT" };
  fields.push("fontSize");

  style.bold = tokens.bold;
  fields.push("bold");

  style.italic = tokens.italic;
  fields.push("italic");

  if (tokens.fontColor) {
    style.foregroundColor = {
      opaqueColor: { rgbColor: hexToApiColor(tokens.fontColor) },
    };
    fields.push("foregroundColor");
  }

  const requests: SlidesApiRequest[] = [
    {
      updateTextStyle: {
        objectId,
        style,
        fields: fields.join(","),
      },
    },
  ];

  if (tokens.lineSpacing !== undefined) {
    requests.push({
      updateParagraphStyle: {
        objectId,
        style: { lineSpacing: tokens.lineSpacing },
        fields: "lineSpacing",
      },
    });
  }

  return requests;
}

function buildFillRequest(
  objectId: string,
  fillColor: string
): SlidesApiRequest {
  return {
    updateShapeProperties: {
      objectId,
      shapeProperties: {
        shapeBackgroundFill: {
          solidFill: { color: { rgbColor: hexToApiColor(fillColor) } },
        },
      },
      fields: "shapeBackgroundFill.solidFill.color",
    },
  };
}

/**
 * Plan Slides API batchUpdate requests to restyle master/layout placeholders
 * to match the exemplar StyleMap.
 */
export function planMasterPatches(
  styleMap: StyleMap,
  masterLayouts: MasterLayoutSnapshot
): MasterPatchPlan {
  const requests: SlidesApiRequest[] = [];
  const matched: MasterPatchMatch[] = [];
  const skipped: MasterPatchSkip[] = [];

  for (const page of masterLayouts.pages) {
    for (const placeholder of page.placeholders) {
      const role = PLACEHOLDER_TO_ROLE[placeholder.placeholderType];

      if (!role) {
        skipped.push({
          placeholderType: placeholder.placeholderType,
          placeholderObjectId: placeholder.objectId,
          pageObjectId: page.objectId,
          reason: "no_role_mapping",
        });
        continue;
      }

      const tokens = styleMap[role];
      if (!tokens) {
        skipped.push({
          placeholderType: placeholder.placeholderType,
          placeholderObjectId: placeholder.objectId,
          pageObjectId: page.objectId,
          reason: "no_stylemap_entry",
        });
        continue;
      }

      // Text style + paragraph style
      requests.push(...buildTextStyleRequests(placeholder.objectId, tokens));

      // Fill for CALLOUT role
      if (role === "CALLOUT" && tokens.fillColor) {
        requests.push(buildFillRequest(placeholder.objectId, tokens.fillColor));
      }

      matched.push({
        role,
        placeholderObjectId: placeholder.objectId,
        pageObjectId: page.objectId,
        pageType: page.pageType,
      });
    }
  }

  return { requests, matched, skipped };
}
