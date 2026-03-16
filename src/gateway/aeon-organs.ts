import { type AeonOrgan, type MemoryNode, updateAeonOrgans, getAeonOrgans } from "./aeon-state.js";
import { calculatePeanoIndex } from "../utils/peano.js";

const ORGAN_DISTANCE_THRESHOLD = 0.05; // Maximum distance in Peano-space to be considered for same organ

/**
 * Condenses memory nodes into functional organs based on topological proximity.
 */
export function condenseOrgans(nodes: MemoryNode[]): void {
  const alignableNodes = nodes
    .filter((n) => n.peanoIndex !== undefined)
    .sort((a, b) => (a.peanoIndex || 0) - (b.peanoIndex || 0));

  if (alignableNodes.length === 0) return;

  const newOrgans: AeonOrgan[] = [];
  let currentOrganNodes: MemoryNode[] = [alignableNodes[0]];

  for (let i = 1; i < alignableNodes.length; i++) {
    const prev = alignableNodes[i - 1];
    const curr = alignableNodes[i];

    if (curr.peanoIndex! - prev.peanoIndex! < ORGAN_DISTANCE_THRESHOLD) {
      currentOrganNodes.push(curr);
    } else {
      newOrgans.push(createOrganFromNodes(currentOrganNodes));
      currentOrganNodes = [curr];
    }
  }

  if (currentOrganNodes.length > 0) {
    newOrgans.push(createOrganFromNodes(currentOrganNodes));
  }

  updateAeonOrgans(newOrgans);
}

function createOrganFromNodes(nodes: MemoryNode[]): AeonOrgan {
  const id = `organ-${nodes[0].id}`;
  // Heuristic: take the first few words of the first node as a label for now
  const label = nodes[0].content.split(" ").slice(0, 3).join(" ") + "...";

  return {
    id,
    label,
    nodeIds: nodes.map((n) => n.id),
    resonance: 1.0, // Initial resonance
  };
}

/**
 * Updates resonance of organs based on active node IDs.
 */
export function pulseOrgans(activeNodeIds: string[]): void {
  const organs = getAeonOrgans();
  const updatedOrgans = organs.map((organ) => {
    const isActive = organ.nodeIds.some((id) => activeNodeIds.includes(id));
    return {
      ...organ,
      resonance: isActive
        ? Math.min(2.0, organ.resonance + 0.1)
        : Math.max(0.5, organ.resonance - 0.05),
    };
  });
  updateAeonOrgans(updatedOrgans);
}
