// REV-016 #5 Single connection rule UT tests
// Trace: REV-016 #5

import { describe, it, expect } from "vitest";
import { filterExistingEdgesForSameTarget } from "@webview/services/connectionHelpers.js";
import type { FlowEdge } from "@webview/components/FlowEditorApp.js";

function makeEdge(id: string, source: string, target: string, targetHandle?: string): FlowEdge {
  return { id, source, target, targetHandle };
}

describe("filterExistingEdgesForSameTarget — single connection rule", () => {
  // DDUT-02-004002-00020 — 2nd edge to same port removes 1st
  it("sameTargetPort_existingEdgeRemoved", () => {
    const edges = [
      makeEdge("e1", "n1", "n3", "in"),
      makeEdge("e2", "n1", "n2", "in"),
    ];

    // Connecting n2 → n3:in — should remove e1 (n1→n3:in)
    const result = filterExistingEdgesForSameTarget(edges, "n3", "in");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e2"); // only e2 remains
  });

  // DDUT-02-004002-00021 — different target port unaffected
  it("differentTargetPort_edgesPreserved", () => {
    const edges = [
      makeEdge("e1", "n1", "n3", "in"),
      makeEdge("e2", "n2", "n3", "config"),
    ];

    // Connecting to n3:in — only e1 should be removed
    const result = filterExistingEdgesForSameTarget(edges, "n3", "in");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e2");
  });

  // DDUT-02-004002-00022 — no existing edge to target port
  it("noExistingEdge_allEdgesPreserved", () => {
    const edges = [
      makeEdge("e1", "n1", "n2", "in"),
      makeEdge("e2", "n2", "n3", "in"),
    ];

    // Connecting to n4:in — no existing edge, all preserved
    const result = filterExistingEdgesForSameTarget(edges, "n4", "in");

    expect(result).toHaveLength(2);
  });

  // DDUT-02-004002-00023 — undefined targetHandle
  it("undefinedTargetHandle_matchesUndefinedEdges", () => {
    const edges = [
      makeEdge("e1", "n1", "n3", undefined),
      makeEdge("e2", "n2", "n3", "in"),
    ];

    // Connecting to n3 with undefined handle — e1 removed
    const result = filterExistingEdgesForSameTarget(edges, "n3", undefined);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e2");
  });

  // DDUT-02-004002-00024 — empty edges array
  it("emptyEdges_returnsEmptyArray", () => {
    const result = filterExistingEdgesForSameTarget([], "n3", "in");
    expect(result).toEqual([]);
  });

  // DDUT-02-004002-00025 — multiple edges to same target port all removed
  it("multipleEdgesToSamePort_allRemoved", () => {
    const edges = [
      makeEdge("e1", "n1", "n3", "in"),
      makeEdge("e2", "n2", "n3", "in"),
    ];

    const result = filterExistingEdgesForSameTarget(edges, "n3", "in");
    expect(result).toHaveLength(0);
  });
});
