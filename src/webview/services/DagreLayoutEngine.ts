// Trace: REV-016 #8 — Dagre-based layout engine implementation
import dagre from "@dagrejs/dagre";
import type { ILayoutEngine, LayoutNode, LayoutEdge, LayoutOptions } from "../interfaces/ILayoutEngine.js";

export class DagreLayoutEngine implements ILayoutEngine {
  layout(nodes: LayoutNode[], edges: LayoutEdge[], options: LayoutOptions): LayoutNode[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: options.direction === "LR" ? "LR" : "TB",
      nodesep: options.nodeSpacing,
      ranksep: options.rankSpacing,
    });

    for (const node of nodes) {
      g.setNode(node.id, { width: node.width, height: node.height });
    }
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    return nodes.map((node) => {
      const pos = g.node(node.id);
      return {
        ...node,
        position: {
          x: pos.x - node.width / 2,
          y: pos.y - node.height / 2,
        },
      };
    });
  }
}
