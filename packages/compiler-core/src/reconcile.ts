import type { DeckSnapshot, PatchRecord, ReconcileState } from "@magistrat/shared-types";

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

    const currentSignature = shapeSignature(shape);
    const beforeSignature = JSON.stringify(patch.before);
    const afterSignature = JSON.stringify(patch.after);

    if (currentSignature === afterSignature) {
      return {
        patch,
        nextState: "applied"
      };
    }

    if (currentSignature === beforeSignature) {
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

function shapeSignature(shape: DeckSnapshot["slides"][number]["shapes"][number]): string {
  const run = shape.textRuns[0];
  if (!run) {
    return JSON.stringify({});
  }

  return JSON.stringify({
    fontFamily: run.fontFamily,
    fontSizePt: run.fontSizePt,
    fontColor: run.fontColor,
    bold: run.bold,
    italic: run.italic,
    bulletIndent: shape.paragraphs[0]?.bulletIndent,
    bulletHanging: shape.paragraphs[0]?.bulletHanging
  });
}
