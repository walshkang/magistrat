import type { DeckSnapshot, ReconcileSignature } from "@magistrat/shared-types";

export function buildReconcileSignatureFromShape(
  shape: DeckSnapshot["slides"][number]["shapes"][number] | undefined
): ReconcileSignature {
  if (!shape) {
    return emptySignature();
  }

  const run = shape.textRuns[0];

  return {
    fontFamily: run?.fontFamily ?? null,
    fontSizePt: run?.fontSizePt ?? null,
    fontColor: run?.fontColor ?? null,
    bold: run?.bold ?? null,
    italic: run?.italic ?? null,
    bulletIndent: shape.paragraphs[0]?.bulletIndent ?? null,
    bulletHanging: shape.paragraphs[0]?.bulletHanging ?? null
  };
}

export function emptySignature(): ReconcileSignature {
  return {
    fontFamily: null,
    fontSizePt: null,
    fontColor: null,
    bold: null,
    italic: null,
    bulletIndent: null,
    bulletHanging: null
  };
}
