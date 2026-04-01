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

// Trace: DD-04-003006 — find nodes in the loop body sub-graph
// Returns node IDs reachable from the "body" port but NOT from the "done" port
export function findBodyNodes(
  loopNodeId: string,
  edges: EdgeInstance[],
): Set<string> {
  const reachableFrom = (portId: string): Set<string> => {
    const visited = new Set<string>();
    const queue: string[] = [];
    for (const edge of edges) {
      if (edge.sourceNodeId === loopNodeId && edge.sourcePortId === portId) {
        queue.push(edge.targetNodeId);
      }
    }
    while (queue.length > 0) {
      const nid = queue.shift()!;
      if (visited.has(nid)) continue;
      visited.add(nid);
      for (const edge of edges) {
        if (edge.sourceNodeId === nid && !visited.has(edge.targetNodeId)) {
          queue.push(edge.targetNodeId);
        }
      }
    }
    return visited;
  };

  const bodyReachable = reachableFrom("body");
  const doneReachable = reachableFrom("done");

  // Body-only: reachable from body but not from done
  for (const id of doneReachable) {
    bodyReachable.delete(id);
  }
  return bodyReachable;
}

// Trace: FEAT-00006-003002 — find try/catch sub-graph nodes
export function findTryCatchNodes(
  tryCatchNodeId: string,
  edges: EdgeInstance[],
): { tryNodes: Set<string>; catchNodes: Set<string> } {
  const reachableFrom = (portId: string): Set<string> => {
    const visited = new Set<string>();
    const queue: string[] = [];
    for (const edge of edges) {
      if (edge.sourceNodeId === tryCatchNodeId && edge.sourcePortId === portId) {
        queue.push(edge.targetNodeId);
      }
    }
    while (queue.length > 0) {
      const nid = queue.shift()!;
      if (visited.has(nid)) continue;
      visited.add(nid);
      for (const edge of edges) {
        if (edge.sourceNodeId === nid && !visited.has(edge.targetNodeId)) {
          queue.push(edge.targetNodeId);
        }
      }
    }
    return visited;
  };

  const tryReachable = reachableFrom("try");
  const catchReachable = reachableFrom("catch");
  const doneReachable = reachableFrom("done");

  // Try-only: reachable from try but not from catch or done
  const tryNodes = new Set(tryReachable);
  for (const id of catchReachable) tryNodes.delete(id);
  for (const id of doneReachable) tryNodes.delete(id);

  // Catch-only: reachable from catch but not from try or done
  const catchNodes = new Set(catchReachable);
  for (const id of tryReachable) catchNodes.delete(id);
  for (const id of doneReachable) catchNodes.delete(id);

  return { tryNodes, catchNodes };
}

// Trace: FEAT-00007-003002 — find parallel branch sub-graph nodes
export function findParallelBranches(
  parallelNodeId: string,
  edges: EdgeInstance[],
): Map<string, Set<string>> {
  const branchPorts = ["branch1", "branch2", "branch3"];

  const reachableFrom = (portId: string): Set<string> => {
    const visited = new Set<string>();
    const queue: string[] = [];
    for (const edge of edges) {
      if (edge.sourceNodeId === parallelNodeId && edge.sourcePortId === portId) {
        queue.push(edge.targetNodeId);
      }
    }
    while (queue.length > 0) {
      const nid = queue.shift()!;
      if (visited.has(nid)) continue;
      visited.add(nid);
      for (const edge of edges) {
        if (edge.sourceNodeId === nid && !visited.has(edge.targetNodeId)) {
          queue.push(edge.targetNodeId);
        }
      }
    }
    return visited;
  };

  const doneReachable = reachableFrom("done");
  const allBranch = new Map<string, Set<string>>();
  const branchSets: Set<string>[] = [];

  for (const port of branchPorts) {
    const reachable = reachableFrom(port);
    branchSets.push(reachable);
  }

  for (let idx = 0; idx < branchPorts.length; idx++) {
    const exclusive = new Set(branchSets[idx]);
    // Remove nodes reachable from done
    for (const id of doneReachable) exclusive.delete(id);
    // Remove nodes that belong to other branches
    for (let other = 0; other < branchSets.length; other++) {
      if (other === idx) continue;
      for (const id of branchSets[other]) exclusive.delete(id);
    }
    if (exclusive.size > 0) {
      allBranch.set(branchPorts[idx], exclusive);
    }
  }

  return allBranch;
}
