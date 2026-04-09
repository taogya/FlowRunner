// Trace: FEAT-00010-002002, FEAT-00010-002003, FEAT-00010-002004
// Selection/Copy helper functions — extracted from FlowEditorApp handlers

import type { FlowNode, FlowEdge } from "../components/FlowEditorApp.js";

export const DEFAULT_NODE_DIMENSIONS = {
  width: 160,
  height: 60,
} as const;

/** Extract selected nodes from node list */
export function getSelectedNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.filter((n) => (n as FlowNode & { selected?: boolean }).selected);
}

/** Extract internal edges (both endpoints within selected nodes) */
export function getInternalEdges(edges: FlowEdge[], selectedNodeIds: Set<string>): FlowEdge[] {
  return edges.filter((e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));
}

/** Create pasted/duplicated nodes with new IDs and offset */
export function createRemappedNodes(
  nodes: FlowNode[],
  offset: number,
  idGenerator: () => string,
): { newNodes: FlowNode[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const newNodes = nodes.map((n) => {
    const newId = idGenerator();
    idMap.set(n.id, newId);
    return {
      ...n,
      id: newId,
      position: { x: n.position.x + offset, y: n.position.y + offset },
      selected: true,
    };
  });
  return { newNodes, idMap };
}

/** Remap edge source/target using ID map */
export function remapEdges(edges: FlowEdge[], idMap: Map<string, string>): FlowEdge[] {
  return edges.map((e) => ({
    ...e,
    id: `e-${idMap.get(e.source)}-${idMap.get(e.target)}-remapped`,
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }));
}

// Trace: FEAT-00013-002002
export function getTopLeftFromCenter(
  center: { x: number; y: number },
  dimensions: { width: number; height: number } = DEFAULT_NODE_DIMENSIONS,
): { x: number; y: number } {
  return {
    x: center.x - dimensions.width / 2,
    y: center.y - dimensions.height / 2,
  };
}

// Trace: FEAT-00013-002002
export function placeNodesAroundCenter(
  nodes: FlowNode[],
  center: { x: number; y: number },
  dimensions: { width: number; height: number } = DEFAULT_NODE_DIMENSIONS,
): FlowNode[] {
  if (nodes.length === 0) {
    return [];
  }

  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + dimensions.width));
  const maxY = Math.max(...nodes.map((node) => node.position.y + dimensions.height));
  const anchorX = (minX + maxX) / 2;
  const anchorY = (minY + maxY) / 2;
  const dx = center.x - anchorX;
  const dy = center.y - anchorY;

  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + dx,
      y: node.position.y + dy,
    },
    selected: true,
  }));
}
