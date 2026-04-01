# Cursor Prompt: Track A Slice 3 — Image Intrinsic Dimensions

> Paste this into Cursor Composer. Extends the IR with intrinsic image dimensions, updates both adapters and the GAS bridge, and implements BP-LAYOUT-005 (Aspect Ratio Distortion).

---

## Context

Magistrat's IR captures rendered geometry for all shapes (`geometry.width`, `geometry.height`) but has no intrinsic (original) image dimensions. This means we can't detect stretched/squished images — one of the most visible compliance issues in exec decks.

This slice adds an `imageMetadata` field to `ShapeSnapshot`, extracts intrinsic dimensions from both Google Slides and Office, and implements BP-LAYOUT-005.

**Pattern to follow:** Track A Slices 1 and 2 (`docs/prompts/track_a_slice1.md`, `track_a_slice2.md`). Same vertical-slice approach.

---

## Part 1 — IR Extension

### File: `packages/shared-types/src/ir.ts`

Add a new interface and an optional field on `ShapeSnapshot`:

```typescript
export interface ImageMetadata {
  /** Original image width in points (converted from pixels or EMU at extraction time) */
  intrinsicWidth: number;
  /** Original image height in points */
  intrinsicHeight: number;
  /** MIME type if available, e.g. "image/png", "image/jpeg" */
  mimeType?: string;
}
```

Add to `ShapeSnapshot`:
```typescript
export interface ShapeSnapshot {
  // ... existing fields ...
  /** Intrinsic image dimensions when shapeType === "IMAGE" */
  imageMetadata?: ImageMetadata | undefined;
}
```

Export `ImageMetadata` from the module.

**Units decision:** Store intrinsic dimensions in **points** (matching `geometry.width`/`geometry.height`). The GAS bridge and Office adapter convert from their native units at extraction time. This keeps the rule logic simple — no unit conversion needed in `checks.ts`.

---

## Part 2 — Evidence Type

### File: `packages/shared-types/src/findings.ts`

Add `"MEDIA_METADATA"` to the `EVIDENCE_TYPES` array (after `"TEXT_STRING_EVIDENCE"` or `"TABLE_EVIDENCE"` if Slice 2 already added that):

```typescript
export const EVIDENCE_TYPES = [
  // ... existing ...
  "MEDIA_METADATA"       // ← NEW
] as const;
```

---

## Part 3 — Patch Op

### File: `packages/shared-types/src/patches.ts`

Add to `PATCH_OP_VALUES`:
```typescript
"RESTORE_ASPECT_RATIO"
```

### File: `packages/compiler-core/src/constants.ts`

Add `"RESTORE_ASPECT_RATIO"` to `SAFE_PATCH_OPS`.

Update `PLAYBOOK_RULE_COUNT`: bump by 1 (BP-LAYOUT-005 is `source: "playbook"`).

---

## Part 4 — GAS Bridge Extension

### File: `apps/slides-addon/gas/Code.gs`

In `readPresentation()`, add a new block for IMAGE elements. Currently IMAGE page elements fall through with only geometry. Add after the SHAPE block (and TABLE block if Slice 2 is merged):

```javascript
if (el.getPageElementType() === SlidesApp.PageElementType.IMAGE) {
  var image = el.asImage();
  element.elementType = 'IMAGE';

  // Intrinsic dimensions
  // Google Apps Script Image class exposes getWidth()/getHeight() on the
  // PageElement (rendered size) but NOT intrinsic pixel dimensions directly.
  //
  // Strategy: use image.getSourceUrl() or image.getBlob() to get the
  // original image, then read its dimensions. However, getBlob() is
  // expensive and getSourceUrl() may be null for pasted images.
  //
  // Alternative: The Slides REST API (presentations.get) returns
  // `imageProperties.contentUri` and the image's intrinsic size in
  // `size.width/height` on the page element. But we're in Apps Script,
  // not REST.
  //
  // Best available approach in GAS:
  // Use the Advanced Slides Service (must be enabled) to call the REST API.
  try {
    var presentationId = SlidesApp.getActivePresentation().getId();
    var pageId = slide.getObjectId();
    // Advanced Slides Service: Slides.Presentations.Pages.get()
    // Returns the full page JSON including pageElements with imageProperties
    var pageData = Slides.Presentations.Pages.get(presentationId, pageId);
    if (pageData && pageData.pageElements) {
      for (var pe = 0; pe < pageData.pageElements.length; pe++) {
        var apiEl = pageData.pageElements[pe];
        if (apiEl.objectId === el.getObjectId() && apiEl.image) {
          // REST API returns size in EMU (English Metric Units)
          // 1 point = 12700 EMU
          var EMU_PER_PT = 12700;
          if (apiEl.image.sourceUrl) {
            element.imageSourceUrl = apiEl.image.sourceUrl;
          }
          // The intrinsic size isn't directly in the REST response either.
          // The REST API gives us `size` (rendered) and `transform`.
          // For intrinsic dimensions, we need the image blob.
          break;
        }
      }
    }
  } catch (e) {
    // Advanced Slides Service not available or API error — skip
  }

  // Fallback: use getBlob() to read image dimensions
  // This is the most reliable approach but can be slow for large images.
  try {
    var blob = image.getBlob();
    if (blob) {
      var contentType = blob.getContentType();
      element.imageMimeType = contentType;

      // For PNG and JPEG, we can read dimensions from the binary header
      // without decoding the full image.
      var bytes = blob.getBytes();
      var dims = getImageDimensions(bytes, contentType);
      if (dims) {
        // Convert pixels to points (1 px = 0.75 pt at 96 DPI)
        // But we don't know the actual DPI. Store raw pixels and let
        // the rule compare aspect ratios (px ratio == pt ratio).
        element.intrinsicWidthPx = dims.width;
        element.intrinsicHeightPx = dims.height;
      }
    }
  } catch (e) {
    // Blob not accessible (external URL image, DRM, etc.) — skip
  }
}
```

Add a helper function to extract dimensions from image binary headers:

```javascript
/**
 * Extract width/height from PNG or JPEG binary header.
 * Returns { width, height } or null if format not recognized.
 */
function getImageDimensions(bytes, contentType) {
  if (!bytes || bytes.length < 24) return null;

  // PNG: bytes 16-23 contain width (4 bytes BE) and height (4 bytes BE)
  if (contentType === 'image/png' || (bytes[0] === -119 && bytes[1] === 80)) {
    // PNG signature: 0x89 0x50 0x4E 0x47
    // IHDR chunk starts at byte 8, width at 16, height at 20
    var w = ((bytes[16] & 0xFF) << 24) | ((bytes[17] & 0xFF) << 16) |
            ((bytes[18] & 0xFF) << 8)  | (bytes[19] & 0xFF);
    var h = ((bytes[20] & 0xFF) << 24) | ((bytes[21] & 0xFF) << 16) |
            ((bytes[22] & 0xFF) << 8)  | (bytes[23] & 0xFF);
    if (w > 0 && h > 0) return { width: w, height: h };
  }

  // JPEG: scan for SOF0 (0xFF 0xC0) or SOF2 (0xFF 0xC2) marker
  if (contentType === 'image/jpeg' || (bytes[0] === -1 && bytes[1] === -40)) {
    var offset = 2;
    while (offset < bytes.length - 9) {
      if ((bytes[offset] & 0xFF) === 0xFF) {
        var marker = bytes[offset + 1] & 0xFF;
        if (marker === 0xC0 || marker === 0xC2) {
          // SOF: height at offset+5 (2 bytes BE), width at offset+7 (2 bytes BE)
          var h = ((bytes[offset + 5] & 0xFF) << 8) | (bytes[offset + 6] & 0xFF);
          var w = ((bytes[offset + 7] & 0xFF) << 8) | (bytes[offset + 8] & 0xFF);
          if (w > 0 && h > 0) return { width: w, height: h };
        }
        // Skip to next marker
        var segLen = ((bytes[offset + 2] & 0xFF) << 8) | (bytes[offset + 3] & 0xFF);
        offset += 2 + segLen;
      } else {
        offset++;
      }
    }
  }

  // GIF: width at bytes 6-7 (LE), height at 8-9 (LE)
  if (contentType === 'image/gif' || (bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70)) {
    var w = (bytes[6] & 0xFF) | ((bytes[7] & 0xFF) << 8);
    var h = (bytes[8] & 0xFF) | ((bytes[9] & 0xFF) << 8);
    if (w > 0 && h > 0) return { width: w, height: h };
  }

  return null;
}
```

**Why pixel-level extraction:** The Google Slides API (even REST) doesn't expose intrinsic image dimensions directly. The most reliable method is reading the binary header. This is fast (only reads first ~1KB) and handles PNG, JPEG, and GIF which cover 99%+ of slide images.

**Performance note:** `getBlob()` downloads the full image. For decks with many large images, this could be slow. We accept this for v1 — the compliance value is high and it only runs on scan, not continuously.

---

## Part 5 — Bridge Types

### File: `packages/google-adapter/src/bridge-types.ts`

Add optional image fields to `GoogleBridgePageElement`:

```typescript
export interface GoogleBridgePageElement {
  // ... existing fields ...
  intrinsicWidthPx?: number;    // ← NEW
  intrinsicHeightPx?: number;   // ← NEW
  imageMimeType?: string;       // ← NEW
}
```

---

## Part 6 — Google Mapper

### File: `packages/google-adapter/src/providers/google-mappers.ts`

In `mapPageElement()`, when `shapeType === "IMAGE"` and intrinsic dimensions are present, populate `imageMetadata`:

```typescript
// After existing field mapping, before the return:
const imageMetadata = shapeType === "IMAGE" &&
  typeof element.intrinsicWidthPx === "number" &&
  typeof element.intrinsicHeightPx === "number"
  ? {
      // Convert pixels to points for consistency with geometry fields.
      // Aspect ratio comparison doesn't need exact point values —
      // pixel ratio == point ratio — but storing in points keeps the
      // IR consistent. Use 96 DPI assumption: 1px = 0.75pt.
      intrinsicWidth: element.intrinsicWidthPx * 0.75,
      intrinsicHeight: element.intrinsicHeightPx * 0.75,
      ...(element.imageMimeType ? { mimeType: element.imageMimeType } : {})
    }
  : undefined;
```

Add to the returned ShapeSnapshot:
```typescript
...(imageMetadata ? { imageMetadata } : {}),
```

---

## Part 7 — Office Adapter

### File: `packages/office-adapter/src/providers/office-readonly-provider.ts`

Office.js / OOXML exposes image dimensions differently. The PowerPoint API requirement set 1.1+ has `shape.image` for image shapes.

For IMAGE shapes, after loading basic properties:

```typescript
if (normalizeShapeType(entry.shape.type) === "IMAGE") {
  try {
    // Office.js: shape.image exposes getBase64Image() but not intrinsic dims
    // OOXML approach: the image relationship file in the .pptx ZIP contains
    // the actual image binary. However, Office.js doesn't provide direct
    // access to the raw image bytes in the same way as GAS.
    //
    // Best available: Office.js 1.9+ has shape.image with getBase64Image()
    // We can decode the base64 header to extract dimensions (same binary
    // header parsing approach as GAS).
    const imageProp = (entry.shape as any).image;
    if (imageProp) {
      // getBase64Image() returns a Promise<string> with the full base64 image
      // This is expensive but reliable.
      try {
        const base64 = await imageProp.getBase64Image();
        if (base64) {
          // Decode just enough of the base64 to read the header
          // atob() gives us the binary string
          const binaryStr = atob(base64.substring(0, 200)); // first ~150 bytes is enough
          const bytes = [];
          for (let i = 0; i < binaryStr.length; i++) {
            bytes.push(binaryStr.charCodeAt(i));
          }
          const dims = getImageDimensionsFromBytes(bytes);
          if (dims) {
            imageMetadata = {
              intrinsicWidth: dims.width * 0.75,  // px to pt
              intrinsicHeight: dims.height * 0.75,
            };
          }
        }
      } catch { /* getBase64Image not available in this API version */ }
    }
  } catch {
    // Image API unavailable — skip
  }
}
```

Add the same `getImageDimensionsFromBytes` helper (TypeScript version of the GAS function):

```typescript
function getImageDimensionsFromBytes(bytes: number[]): { width: number; height: number } | null {
  if (bytes.length < 24) return null;

  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (w > 0 && h > 0) return { width: w, height: h };
  }

  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    while (offset < bytes.length - 9) {
      if (bytes[offset] === 0xFF) {
        const marker = bytes[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          const h = (bytes[offset + 5] << 8) | bytes[offset + 6];
          const w = (bytes[offset + 7] << 8) | bytes[offset + 8];
          if (w > 0 && h > 0) return { width: w, height: h };
        }
        const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += 2 + segLen;
      } else {
        offset++;
      }
    }
  }

  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    const w = bytes[6] | (bytes[7] << 8);
    const h = bytes[8] | (bytes[9] << 8);
    if (w > 0 && h > 0) return { width: w, height: h };
  }

  return null;
}
```

**Important:** If `getBase64Image()` is not available (older Office versions), `imageMetadata` stays `undefined` and the rule silently skips. This is the same graceful degradation pattern as the Office table adapter.

---

## Part 8 — Rule Implementation: BP-LAYOUT-005

### File: `packages/compiler-core/src/checks.ts`

**Source:** `"playbook"` | **Severity:** `"error"` | **Risk:** `"safe"`

Add the check inside the existing per-shape loop (or in a separate image-checking section):

```typescript
// BP-LAYOUT-005 — Aspect Ratio Distortion
if (shape.shapeType === "IMAGE" && shape.imageMetadata) {
  const intrinsic = shape.imageMetadata;
  const rendered = shape.geometry;

  // Guard against zero dimensions
  if (intrinsic.intrinsicWidth > 0 && intrinsic.intrinsicHeight > 0 &&
      rendered.width > 0 && rendered.height > 0) {

    const intrinsicRatio = intrinsic.intrinsicWidth / intrinsic.intrinsicHeight;
    const renderedRatio = rendered.width / rendered.height;

    const DISTORTION_THRESHOLD = 0.01;  // ~1% aspect ratio drift

    if (Math.abs(intrinsicRatio - renderedRatio) > DISTORTION_THRESHOLD) {
      // Calculate what the correct height should be (preserving width)
      const correctedHeight = rendered.width / intrinsicRatio;

      pushFinding({
        ruleId: "BP-LAYOUT-005",
        slideId: slide.slideId,
        objectId: shape.objectId,
        severity: "error",
        source: "playbook",
        risk: "safe",
        observed: {
          renderedWidth: rendered.width,
          renderedHeight: rendered.height,
          renderedRatio: Math.round(renderedRatio * 1000) / 1000,
          intrinsicRatio: Math.round(intrinsicRatio * 1000) / 1000,
        },
        expected: {
          aspectRatio: Math.round(intrinsicRatio * 1000) / 1000,
        },
        evidence: [
          { type: "GEOMETRIC_EVIDENCE", detail: `Rendered aspect ratio ${renderedRatio.toFixed(3)} differs from intrinsic ${intrinsicRatio.toFixed(3)}` },
          { type: "MEDIA_METADATA", detail: `Original image: ${Math.round(intrinsic.intrinsicWidth / 0.75)}×${Math.round(intrinsic.intrinsicHeight / 0.75)}px` }
        ],
        suggestedFix: {
          op: "RESTORE_ASPECT_RATIO",
          height: correctedHeight
        }
      });
    }
  }
}
```

**Design notes:**
- Auto-fix restores height based on current width (preserves horizontal layout). Width is usually the intentional dimension; height gets distorted during manual resize.
- Threshold of 0.01 (~1%) catches visible distortion while allowing sub-pixel rounding differences.
- Full-bleed images (where `geometry.width` ≈ slide width AND `geometry.height` ≈ slide height) could be intentionally stretched backgrounds. Consider skipping shapes where both dimensions are within 5% of slide dimensions. However, for v1, flag all distortions — users can ignore background images via the existing ignore workflow.
- `RESTORE_ASPECT_RATIO` is suggestion-only (no write-side implementation yet).

---

## Part 9 — Tests

### New file: `packages/compiler-core/tests/track-a-slice3.test.ts`

Follow the pattern from `track-a-slice1.test.ts` and `track-a-slice2.test.ts`.

### Fixture helper — add to `packages/compiler-core/tests/fixtures.ts`:

```typescript
export function createImageShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    shapeType: "IMAGE",
    supportedForAnalysis: false,
    geometry: {
      left: 100,
      top: 100,
      width: 300,   // rendered: 4:3 ratio
      height: 225,
      rotation: 0
    },
    imageMetadata: {
      intrinsicWidth: 300,  // matches rendered = no distortion
      intrinsicHeight: 225,
    },
    ...overrides
  });
}
```

### Test cases for BP-LAYOUT-005:

1. **Happy path — distorted image:** `geometry: { width: 300, height: 300 }` (1:1 rendered) but `imageMetadata: { intrinsicWidth: 400, intrinsicHeight: 300 }` (4:3 intrinsic) → finding with ruleId `BP-LAYOUT-005`, severity `error`
2. **Negative — correct ratio:** rendered 300×225, intrinsic 400×300 (both 4:3) → no finding
3. **Edge — within threshold:** intrinsic ratio 1.333, rendered ratio 1.340 (diff = 0.007 < 0.01) → no finding
4. **Edge — just over threshold:** intrinsic ratio 1.333, rendered ratio 1.345 (diff = 0.012 > 0.01) → finding emitted
5. **Edge — no imageMetadata:** IMAGE shape without `imageMetadata` → no finding (graceful skip)
6. **Edge — zero dimensions:** intrinsic width or height is 0 → no finding (guard against division by zero)
7. **Auto-fix values:** verify `suggestedFix.height` equals `renderedWidth / intrinsicRatio` (corrected height preserves width)

### Google adapter mapper test — add to `packages/google-adapter/tests/public-api.test.ts`:

Verify bridge element with `intrinsicWidthPx: 800, intrinsicHeightPx: 600, imageMimeType: "image/png"` maps to `imageMetadata: { intrinsicWidth: 600, intrinsicHeight: 450, mimeType: "image/png" }` (px × 0.75 = pt).

---

## Part 10 — RULE_CATALOG.md

### File: `docs/RULE_CATALOG.md`

Update BP-LAYOUT-005:
- Remove from the **Blocked** list (line ~733)
- Update status to `active` (it may already say `active` — remove the "Needs API investigation" note)

Add to Implementation Roadmap (after Track A Slice 2):

```markdown
### Track A Slice 3 — Image Intrinsic Dimensions (2026-04-01)
Extended IR with `ImageMetadata` on `ShapeSnapshot.imageMetadata`.
GAS bridge extracts dimensions from image binary headers (PNG/JPEG/GIF).
Office adapter: best-effort via `getBase64Image()`.
Unblocks:
- **BP-LAYOUT-005** — Aspect Ratio Distortion
```

---

## Summary of files to modify

| File | Changes |
|---|---|
| `packages/shared-types/src/ir.ts` | Add `ImageMetadata` interface; add `imageMetadata?` to `ShapeSnapshot` |
| `packages/shared-types/src/findings.ts` | Add `"MEDIA_METADATA"` to evidence types |
| `packages/shared-types/src/patches.ts` | Add `"RESTORE_ASPECT_RATIO"` |
| `apps/slides-addon/gas/Code.gs` | IMAGE element handling: `getBlob()` + `getImageDimensions()` header parser |
| `packages/google-adapter/src/bridge-types.ts` | Add `intrinsicWidthPx`, `intrinsicHeightPx`, `imageMimeType` to element |
| `packages/google-adapter/src/providers/google-mappers.ts` | Populate `imageMetadata` for IMAGE shapes, px→pt conversion |
| `packages/office-adapter/src/providers/office-readonly-provider.ts` | `getBase64Image()` + header parsing for IMAGE shapes |
| `packages/compiler-core/src/constants.ts` | Add `RESTORE_ASPECT_RATIO` to safe ops; bump `PLAYBOOK_RULE_COUNT` |
| `packages/compiler-core/src/checks.ts` | BP-LAYOUT-005 aspect ratio check |
| `packages/compiler-core/tests/fixtures.ts` | Add `createImageShape()` helper |
| `packages/compiler-core/tests/track-a-slice3.test.ts` | New test file: 7+ test cases |
| `packages/google-adapter/tests/public-api.test.ts` | Image bridge-to-IR mapping test |
| `docs/RULE_CATALOG.md` | Unblock BP-LAYOUT-005, add roadmap entry |

## Validation

After implementation, run:
```bash
npx vitest run
```

All existing tests must still pass. New tests in `track-a-slice3.test.ts` should add 7+ passing cases.

## GAS API caveat

The `getBlob()` approach downloads the full image binary. If performance is unacceptable on image-heavy decks (20+ images), a future optimization is to use the Advanced Slides Service (`Slides.Presentations.Pages.get()`) to fetch image metadata via REST, or to add a user-facing toggle to skip image analysis. For v1, accept the cost — the compliance value of catching stretched logos is very high.
