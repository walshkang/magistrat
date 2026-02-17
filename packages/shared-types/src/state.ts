import type { Finding } from "./findings.js";
import type { PatchRecord } from "./patches.js";
import type { RoleV1 } from "./roles.js";

export interface RoleStyleTokens {
  fontFamily: string;
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  fontColor: string;
  lineSpacing?: number | undefined;
  bulletIndent?: number | undefined;
  bulletHanging?: number | undefined;
}

export type StyleMap = Partial<Record<RoleV1, RoleStyleTokens>>;

export interface ExemplarSelection {
  slideId: string;
  mode: "original" | "normalized";
  normalizationAppliedToSlide: boolean;
  selectedAtIso: string;
}

export interface RatifyStamp {
  scope: "deck" | "slide_selection";
  styleSignatureHash: string;
  ratifiedAtIso: string;
  notes?: string;
}

export interface CoverageSnapshot {
  analyzedSlides: number;
  totalSlides: number;
  analyzedObjects: number;
  totalObjects: number;
  topUnhandledObjectTypes: string[];
  continuityCoverage: number;
}

export interface DocumentStateV1 {
  schemaVersion: 1;
  lastUpdatedIso: string;
  exemplar?: ExemplarSelection;
  styleMap?: StyleMap;
  findings: Finding[];
  patchLog: PatchRecord[];
  ratify?: RatifyStamp;
  coverage?: CoverageSnapshot;
}
