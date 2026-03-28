import type { SlideStatusEntry } from "../utils/slideStatus.js";

interface MinimapProps {
  slides: SlideStatusEntry[];
  selectedSlideId: string | null;
  onSelectSlide: (slideId: string | null) => void;
}

export function Minimap({ slides, selectedSlideId, onSelectSlide }: MinimapProps) {
  return (
    <nav className="minimap" aria-label="Slide minimap">
      <div className="minimap__strip">
        {slides.map((slide) => (
          <button
            key={slide.slideId}
            type="button"
            className={`minimap__slide ${
              selectedSlideId === slide.slideId ? "minimap__slide--selected" : ""
            }`}
            onClick={() =>
              onSelectSlide(selectedSlideId === slide.slideId ? null : slide.slideId)
            }
            title={`${slide.title || `Slide ${slide.slideIndex}`} — ${slide.findingCount} findings`}
            aria-pressed={selectedSlideId === slide.slideId}
          >
            <span className="minimap__index">{slide.slideIndex}</span>
            <span className={`minimap__dot minimap__dot--${slide.status}`} aria-hidden />
          </button>
        ))}
      </div>
      {selectedSlideId !== null ? (
        <button
          type="button"
          className="minimap__clear btn-ghost btn-sm"
          onClick={() => onSelectSlide(null)}
        >
          Show all slides
        </button>
      ) : null}
    </nav>
  );
}
