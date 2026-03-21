import { describe, it, expect } from "vitest";
import {
  alignPointsTopologically,
  calculatePeanoIndex,
  calculateStrictCurvePointFromScalar,
  projectEmbeddingToCurvePoint,
} from "./peano.js";

describe("Peano Utility", () => {
  it("should calculate a stable index for an embedding", () => {
    const vec1 = [0.1, -0.2, 0.5, 0.9, -0.1, 0, 0.3, 0.4];
    const index1 = calculatePeanoIndex(vec1);
    const index2 = calculatePeanoIndex([...vec1]);

    expect(index1).toBeGreaterThanOrEqual(0);
    expect(index1).toBeLessThanOrEqual(1);
    expect(index1).toBe(index2);
  });

  it("should distinguish different points", () => {
    const vec1 = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const vec2 = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9];

    expect(calculatePeanoIndex(vec1)).not.toBe(calculatePeanoIndex(vec2));
  });

  it("should align points topologically", () => {
    const p1 = { name: "A", vec: [0.1, 0.1] };
    const p2 = { name: "B", vec: [0.9, 0.9] };
    const p3 = { name: "C", vec: [0.12, 0.12] };

    const aligned = alignPointsTopologically([p1, p2, p3], (p) => p.vec);

    expect(aligned[0]).toBe(p1);
    expect(aligned[1]).toBe(p3); // P3 is closer to P1 in Peano space
    expect(aligned[2]).toBe(p2);
  });

  it("is deterministic for projection seed and curve point replay", () => {
    const vec = [0.2, 0.4, -0.8, 0.1, 0.5];
    const p1 = projectEmbeddingToCurvePoint(vec, { projectionSeed: 42 });
    const p2 = projectEmbeddingToCurvePoint(vec, { projectionSeed: 42 });
    expect(p1).toEqual(p2);

    const c1 = calculateStrictCurvePointFromScalar(0.314159, { order: 6 });
    const c2 = calculateStrictCurvePointFromScalar(0.314159, { order: 6 });
    expect(c1).toEqual(c2);
    expect(c1.curveType).toBe("hilbert");
  });
});
