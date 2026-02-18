import type { DeckSnapshot, PatchRecord, ReconcileSignature, ReconcileState } from "@magistrat/shared-types";
import { stableHash } from "./hash.js";

export interface ReconcileResult {
  patch: PatchRecord;
  nextState: ReconcileState;
}

export function reconcilePatches(patches: PatchRecord[], deck: DeckSnapshot): ReconcileResult[] {
  return patches.map((patch) => {
    const slide = deck.slides.find((deckSlide) => deckSlide.slideId === patch.targetFingerprint.slideId);
    const shape = slide?.shapes.find((deckShape) => deckShape.objectId === patch.targetFingerprint.objectId);

    if (!shape) {
      return {
        patch,
        nextState: "missing_target"
      };
    }

    const currentHash = signatureHash(buildReconcileSignatureFromShape(shape));
    const beforeHash = signatureHash(patch.before);
    const afterHash = signatureHash(patch.after);

    if (currentHash === afterHash) {
      return {
        patch,
        nextState: "applied"
      };
    }

    if (currentHash === beforeHash) {
      return {
        patch,
        nextState: "reverted_externally"
      };
    }

    return {
      patch,
      nextState: "drifted"
    };
  });
}

export function buildReconcileSignatureFromShape(
  shape: DeckSnapshot["slides"][number]["shapes"][number] | undefined
): ReconcileSignature {
  if (!shape) {
    return normalizeReconcileSignature();
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

export function normalizeReconcileSignature(signature?: Partial<ReconcileSignature>): ReconcileSignature {
  return {
    fontFamily: typeof signature?.fontFamily === "string" ? signature.fontFamily : null,
    fontSizePt: typeof signature?.fontSizePt === "number" ? signature.fontSizePt : null,
    fontColor: typeof signature?.fontColor === "string" ? signature.fontColor : null,
    bold: typeof signature?.bold === "boolean" ? signature.bold : null,
    italic: typeof signature?.italic === "boolean" ? signature.italic : null,
    bulletIndent: typeof signature?.bulletIndent === "number" ? signature.bulletIndent : null,
    bulletHanging: typeof signature?.bulletHanging === "number" ? signature.bulletHanging : null
  };
}

function signatureHash(signature?: Partial<ReconcileSignature>): string {
  return stableHash(normalizeReconcileSignature(signature));
}
