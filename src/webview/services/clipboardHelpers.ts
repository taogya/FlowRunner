// Trace: FEAT-00010-002002, FEAT-00010-002003, FEAT-00010-002004
// Selection/Copy helper functions — extracted from FlowEditorApp handlers

import type { FlowNode, FlowEdge } from "../components/FlowEditorApp.js";

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
