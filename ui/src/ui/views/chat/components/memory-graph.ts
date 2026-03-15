import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { t } from "../../../../i18n/index.ts";
import type { MemoryGraph, MemoryNode, MemoryEdge } from "../../../types.ts";

export interface MemoryGraphProps {
  graph?: MemoryGraph;
  active?: boolean;
}

export function renderMemoryGraph(props: MemoryGraphProps) {
  if (!props.active || !props.graph || props.graph.nodes.length === 0) {
    return nothing;
  }

  const nodes = props.graph.nodes;
  const edges = props.graph.edges;

  // Simple layout: spread nodes horizontally and vertically
  const width = 600;
  const height = 400;
  const nodeRadius = 24;

  const getPos = (index: number) => {
    const rowSize = 4;
    const padding = 60;
    const col = index % rowSize;
    const row = Math.floor(index / rowSize);
    return {
      x: padding + col * ((width - 2 * padding) / (rowSize - 1 || 1)),
      y: padding + row * 80,
    };
  };

  const nodePositions = nodes.map((_, i) => getPos(i));

  return html`
    <div class="memory-graph-container aeon-glass aeon-entry-anim">
      <div class="memory-graph-header">
        <div class="aeon-shushu-pulse" style="width: 8px; height: 8px; background: var(--aeon-orange);"></div>
        <span class="mono">${t("aeon.memoryGraph") || "LONG_TERM_MEMORY_GRAPH"}</span>
      </div>
      <div class="memory-graph-body">
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
          <!-- Edges -->
          ${repeat(
            edges,
            (edge) => `${edge.source}-${edge.target}`,
            (edge) => {
              const srcIdx = nodes.findIndex((n) => n.id === edge.source);
              const tgtIdx = nodes.findIndex((n) => n.id === edge.target);
              if (srcIdx === -1 || tgtIdx === -1) return nothing;
              const src = nodePositions[srcIdx];
              const tgt = nodePositions[tgtIdx];
              return html`
                <line 
                  x1="${src.x}" y1="${src.y}" 
                  x2="${tgt.x}" y2="${tgt.y}" 
                  class="graph-edge"
                />
              `;
            },
          )}

          <!-- Nodes -->
          ${repeat(
            nodes,
            (node) => node.id,
            (node, i) => {
              const pos = nodePositions[i];
              return html`
                <g class="graph-node-group ${node.type}" transform="translate(${pos.x}, ${pos.y})">
                  ${
                    node.type === "axiom"
                      ? html`
                          <rect x="-12" y="-12" width="24" height="24" transform="rotate(45)" class="graph-node-shape" />
                        `
                      : node.type === "verified"
                        ? html`
                            <circle r="12" class="graph-node-shape" />
                          `
                        : html`
                            <rect x="-10" y="-10" width="20" height="20" class="graph-node-shape" />
                          `
                  }
                  <text y="30" text-anchor="middle" class="graph-node-label">${node.content.slice(0, 15)}...</text>
                  <title>${node.content}</title>
                </g>
              `;
            },
          )}
        </svg>
      </div>
    </div>

    <style>
      .memory-graph-container {
        width: 100%;
        height: 450px;
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(255, 120, 0, 0.2);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        margin-top: 24px;
        overflow: hidden;
      }
      .memory-graph-header {
        background: rgba(255, 120, 0, 0.1);
        padding: 8px 16px;
        border-bottom: 1px solid rgba(255, 120, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.7rem;
        letter-spacing: 1px;
        color: var(--aeon-orange);
      }
      .memory-graph-body {
        flex: 1;
        background: rgba(0, 0, 0, 0.2);
        position: relative;
      }
      .graph-edge {
        stroke: rgba(255, 255, 255, 0.1);
        stroke-width: 1;
        stroke-dasharray: 4;
        animation: dash 20s linear infinite;
      }
      @keyframes dash {
        to { stroke-dashoffset: -100; }
      }
      .graph-node-shape {
        fill: rgba(0, 0, 0, 0.6);
        stroke-width: 2;
        transition: all 0.3s ease;
      }
      .graph-node-group:hover .graph-node-shape {
        stroke-width: 4;
        filter: blur(4px) brightness(1.5);
      }
      .graph-node-group.axiom .graph-node-shape { stroke: var(--aeon-orange); }
      .graph-node-group.verified .graph-node-shape { stroke: var(--aeon-cyan); }
      .graph-node-group.unverified .graph-node-shape { stroke: #888; }
      
      .graph-node-label {
        fill: white;
        font-size: 8px;
        font-family: var(--mono);
        pointer-events: none;
        text-shadow: 0 0 4px black;
      }
    </style>
  `;
}
