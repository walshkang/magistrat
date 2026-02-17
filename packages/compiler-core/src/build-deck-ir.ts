import type { DeckSnapshot } from "@magistrat/shared-types";

export function buildDeckIr(snapshot: DeckSnapshot): DeckSnapshot {
  return {
    deckId: snapshot.deckId,
    generatedAtIso: snapshot.generatedAtIso,
    slides: [...snapshot.slides]
      .sort((a, b) => a.index - b.index)
      .map((slide) => ({
        ...slide,
        shapes: [...slide.shapes].sort((a, b) => a.zIndex - b.zIndex)
      }))
  };
}
