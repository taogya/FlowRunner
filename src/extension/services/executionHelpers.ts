// Trace: DD-04-002003, DD-04-002005
import type { NodeInstance, EdgeInstance, PortDataMap } from "@shared/types/flow.js";

// Trace: DD-04-002003 — Kahn's algorithm
export function topologicalSort(
  nodes: NodeInstance[],
  edges: EdgeInstance[],
): NodeInstance[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeMap = new Map<string, NodeInstance>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    const targets = adjacency.get(edge.sourceNodeId);
    if (targets) targets.push(edge.targetNodeId);
    inDegree.set(
      edge.targetNodeId,
      (inDegree.get(edge.targetNodeId) ?? 0) + 1,
    );
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: NodeInstance[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);

    for (const target of adjacency.get(id) ?? []) {
      const newDegree = (inDegree.get(target) ?? 1) - 1;
      inDegree.set(target, newDegree);
      if (newDegree === 0) queue.push(target);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error("Circular dependency detected in flow");
  }

  return sorted;
}

// Trace: DD-04-002005
export function buildInputs(
  nodeId: string,
  edges: EdgeInstance[],
  outputMap: Map<string, PortDataMap>,
): PortDataMap {
  const inputs: PortDataMap = {};

  for (const edge of edges) {
    if (edge.targetNodeId !== nodeId) continue;
    const sourceOutputs = outputMap.get(edge.sourceNodeId);
    inputs[edge.targetPortId] = sourceOutputs?.[edge.sourcePortId];
  }

  return inputs;
}
