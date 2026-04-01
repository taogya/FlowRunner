// Trace: REV-016 #5 — Single connection rule helper
import type { FlowEdge } from "../components/FlowEditorApp.js";

/**
 * Filter out existing edges targeting the same port on the same node.
 * Ensures 1-input-1-connection rule: when a new edge connects to a target port,
 * any previously connected edge to that same port is removed.
 */
export function filterExistingEdgesForSameTarget(
  edges: FlowEdge[],
  targetNodeId: string,
  targetHandle: string | undefined,
): FlowEdge[] {
  return edges.filter(
    (e) => !(e.target === targetNodeId && e.targetHandle === targetHandle),
  );
}
