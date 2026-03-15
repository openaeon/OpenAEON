import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("consciousness");

/**
 * AEON Collective Consciousness Matrix
 * A high-performance, in-memory shared state for multi-agent synergy.
 */

interface SharedAxiom {
  key: string;
  value: any;
  peano: { x: number; y: number };
  timestamp: number;
}

class CollectiveConsciousness {
  private matrix: Map<string, SharedAxiom> = new Map();

  /**
   * Pulses an axiom into the matrix.
   */
  public pulse(key: string, value: any, peano: { x: number; y: number }) {
    this.matrix.set(key, {
      key,
      value,
      peano,
      timestamp: Date.now(),
    });
    log.debug(`Axiom pulsed into matrix: ${key} at [${peano.x}, ${peano.y}]`);
  }

  /**
   * Retrieves an axiom by key.
   */
  public get(key: string): any {
    return this.matrix.get(key)?.value;
  }

  /**
   * Performs a topological query to find related axioms within a Peano distance.
   */
  public topologicalQuery(peano: { x: number; y: number }, radius: number = 0.2): SharedAxiom[] {
    const results: SharedAxiom[] = [];
    for (const axiom of this.matrix.values()) {
      const dx = axiom.peano.x - peano.x;
      const dy = axiom.peano.y - peano.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        results.push(axiom);
      }
    }
    return results;
  }

  /**
   * Returns a snapshot of the current collective state.
   */
  public getSnapshot() {
    return Array.from(this.matrix.values());
  }

  /**
   * Maintenance: cleanup old axioms.
   */
  public cleanup(maxAgeMs: number = 3600000) {
    // Default 1 hour
    const now = Date.now();
    for (const [key, axiom] of this.matrix.entries()) {
      if (now - axiom.timestamp > maxAgeMs) {
        this.matrix.delete(key);
      }
    }
  }
}

export const matrix = new CollectiveConsciousness();
