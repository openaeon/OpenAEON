/**
 * PEANO-SPACE UTILITY
 * Implements deterministic, locality-sensitive mappings backed by a strict Hilbert curve index.
 * Used for topological alignment of logic gates and memory nodes.
 */

export type EmbeddingVector = number[];
export type CurvePoint2D = { x: number; y: number };

export const DEFAULT_CURVE_ORDER = 8;
export const DEFAULT_PROJECTION_SEED = 1337;
export const MAX_CURVE_ORDER = 10;
export const MIN_CURVE_ORDER = 1;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeDimension(value: number): number {
  // Embeddings are often already roughly -1..1. Clamp to keep deterministic behavior stable.
  return clamp01((value + 1) / 2);
}

function seededWeight(index: number, seed: number, axis: "x" | "y"): number {
  // Deterministic pseudo-random weight in [0.1, 1.0]
  const mix =
    (index + 1) * 1103515245 +
    seed * (axis === "x" ? 12345 : 54321) +
    (axis === "x" ? 97 : 193);
  const normalized = ((mix >>> 0) % 10_000) / 10_000;
  return 0.1 + normalized * 0.9;
}

function rotateQuadrant(
  size: number,
  point: { x: number; y: number },
  rx: number,
  ry: number,
): { x: number; y: number } {
  let { x, y } = point;
  if (ry === 0) {
    if (rx === 1) {
      x = size - 1 - x;
      y = size - 1 - y;
    }
    return { x: y, y: x };
  }
  return { x, y };
}

function xyToHilbertIndex(order: number, x: number, y: number): number {
  const n = 1 << order;
  let xi = x;
  let yi = y;
  let index = 0;
  for (let scale = n >> 1; scale > 0; scale >>= 1) {
    const rx = (xi & scale) > 0 ? 1 : 0;
    const ry = (yi & scale) > 0 ? 1 : 0;
    index += scale * scale * ((3 * rx) ^ ry);
    const rotated = rotateQuadrant(scale, { x: xi, y: yi }, rx, ry);
    xi = rotated.x;
    yi = rotated.y;
  }
  return index;
}

function hilbertIndexToXY(order: number, index: number): { x: number; y: number } {
  const n = 1 << order;
  let x = 0;
  let y = 0;
  let t = Math.max(0, Math.floor(index));
  for (let scale = 1; scale < n; scale <<= 1) {
    const rx = 1 & (t >> 1);
    const ry = 1 & (t ^ rx);
    const rotated = rotateQuadrant(scale, { x, y }, rx, ry);
    x = rotated.x + scale * rx;
    y = rotated.y + scale * ry;
    t >>= 2;
  }
  return { x, y };
}

export function projectEmbeddingToCurvePoint(
  embedding: EmbeddingVector,
  opts: { projectionSeed?: number } = {},
): CurvePoint2D {
  if (embedding.length === 0) {
    return { x: 0.5, y: 0.5 };
  }
  const seed = Number.isFinite(opts.projectionSeed ?? NaN)
    ? Math.floor(opts.projectionSeed ?? DEFAULT_PROJECTION_SEED)
    : DEFAULT_PROJECTION_SEED;
  let xNumerator = 0;
  let yNumerator = 0;
  let xWeight = 0;
  let yWeight = 0;
  for (let i = 0; i < embedding.length; i += 1) {
    const value = normalizeDimension(embedding[i] ?? 0);
    const wx = seededWeight(i, seed, "x");
    const wy = seededWeight(i, seed, "y");
    xNumerator += value * wx;
    yNumerator += value * wy;
    xWeight += wx;
    yWeight += wy;
  }
  return {
    x: clamp01(xNumerator / Math.max(1e-9, xWeight)),
    y: clamp01(yNumerator / Math.max(1e-9, yWeight)),
  };
}

/**
 * Maps a high-dimensional embedding vector to a single 1D index (0-1) by:
 * 1) deterministic projection to 2D
 * 2) strict Hilbert curve indexing
 */
export function calculatePeanoIndex(
  embedding: EmbeddingVector,
  opts: { order?: number; projectionSeed?: number } = {},
): number {
  const order = Math.max(MIN_CURVE_ORDER, Math.min(MAX_CURVE_ORDER, opts.order ?? DEFAULT_CURVE_ORDER));
  const projected = projectEmbeddingToCurvePoint(embedding, {
    projectionSeed: opts.projectionSeed ?? DEFAULT_PROJECTION_SEED,
  });
  const side = 1 << order;
  const maxCoord = side - 1;
  const x = Math.min(maxCoord, Math.floor(projected.x * side));
  const y = Math.min(maxCoord, Math.floor(projected.y * side));
  const index = xyToHilbertIndex(order, x, y);
  const maxIndex = side * side - 1;
  return index / Math.max(1, maxIndex);
}

export function calculateStrictCurvePointFromScalar(
  scalar: number,
  opts: { order?: number } = {},
): { x: number; y: number; index: number; order: number; curveType: "hilbert" } {
  const order = Math.max(MIN_CURVE_ORDER, Math.min(MAX_CURVE_ORDER, opts.order ?? DEFAULT_CURVE_ORDER));
  const side = 1 << order;
  const maxIndex = side * side - 1;
  const normalized = clamp01(scalar);
  const index = Math.min(maxIndex, Math.max(0, Math.round(normalized * maxIndex)));
  const point = hilbertIndexToXY(order, index);
  return {
    x: point.x / Math.max(1, side - 1),
    y: point.y / Math.max(1, side - 1),
    index,
    order,
    curveType: "hilbert",
  };
}

/**
 * Preserves locality by sorting points based on their Peano index.
 */
export function alignPointsTopologically<T>(
  items: T[],
  getEmbedding: (item: T) => EmbeddingVector,
  opts: { order?: number; projectionSeed?: number } = {},
): T[] {
  const scored = items.map((item) => ({
    item,
    index: calculatePeanoIndex(getEmbedding(item), opts),
  }));

  return scored.sort((a, b) => a.index - b.index).map((s) => s.item);
}
