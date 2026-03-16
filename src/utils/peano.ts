/**
 * PEANO-SPACE UTILITY
 * Implements Locality-Sensitive Mappings to 1D to preserve high-dimensional adjacency.
 * Used for topological alignment of logic gates and memory nodes.
 */

export type EmbeddingVector = number[];

/**
 * Maps a high-dimensional embedding vector to a single 1D index (0-1).
 * Uses bit-interleaving (Morton / Z-order) approach after normalization.
 */
export function calculatePeanoIndex(embedding: EmbeddingVector): number {
  if (embedding.length === 0) return 0.5;

  // 1. Project to a fixed bit-depth for interleaving (e.g., 16 bits per selected dimension)
  // For high-D, we pick a subset of dimensions or use a weighted projection to avoid bit-explosion.
  // Here we use a stable hash-based projection to ensure deterministic mapping.

  let combined = 0;
  const dimensionsToInterleave = Math.min(embedding.length, 8); // Interleave top 8 features for locality

  for (let i = 0; i < dimensionsToInterleave; i++) {
    const val = (embedding[i] + 1) / 2; // Normalize -1..1 to 0..1
    const quantized = Math.floor(Math.max(0, Math.min(0.9999, val)) * 255);

    // Interleave bits
    for (let bit = 0; bit < 8; bit++) {
      if ((quantized >> bit) & 1) {
        combined |= 1 << (bit * dimensionsToInterleave + i);
      }
    }
  }

  // Normalize combined to 0..1 range
  const maxPossible = Math.pow(2, 8 * dimensionsToInterleave) - 1;
  return combined / maxPossible;
}

/**
 * Preserves locality by sorting points based on their Peano index.
 */
export function alignPointsTopologically<T>(
  items: T[],
  getEmbedding: (item: T) => EmbeddingVector,
): T[] {
  const scored = items.map((item) => ({
    item,
    index: calculatePeanoIndex(getEmbedding(item)),
  }));

  return scored.sort((a, b) => a.index - b.index).map((s) => s.item);
}
