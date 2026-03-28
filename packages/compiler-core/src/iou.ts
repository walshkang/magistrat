import type { GeometrySnapshot } from "@magistrat/shared-types";

/**
 * Intersection-over-union of two axis-aligned bounding boxes (slide coordinates).
 */
export function computeIOU(a: GeometrySnapshot, b: GeometrySnapshot): number {
  const aRight = a.left + a.width;
  const aBottom = a.top + a.height;
  const bRight = b.left + b.width;
  const bBottom = b.top + b.height;

  const interLeft = Math.max(a.left, b.left);
  const interTop = Math.max(a.top, b.top);
  const interRight = Math.min(aRight, bRight);
  const interBottom = Math.min(aBottom, bBottom);

  const interArea = Math.max(0, interRight - interLeft) * Math.max(0, interBottom - interTop);
  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  const unionArea = aArea + bArea - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}
