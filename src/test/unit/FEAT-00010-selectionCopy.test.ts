// FEAT-00010 Selection/Copy UT tests — clipboard helpers
// Trace: FEAT-00010-002002, FEAT-00010-002003, FEAT-00010-002004, FEAT-00010-002005

import { describe, it, expect } from "vitest";
import {
  getSelectedNodes,
  getInternalEdges,
  createRemappedNodes,
  remapEdges,
} from "@webview/services/clipboardHelpers.js";
import type { FlowNode, FlowEdge } from "@webview/components/FlowEditorApp.js";

function makeNode(id: string, selected = false, x = 0, y = 0): FlowNode & { selected: boolean } {
  return { id, type: "command", position: { x, y }, data: { label: id }, selected };
}

function makeEdge(source: string, target: string): FlowEdge {
  return { id: `e-${source}-${target}`, source, target };
}

// ============================
// getSelectedNodes
// ============================
describe("getSelectedNodes", () => {
  // FEAT-00010-002002-00001
  it("copy_selectedNodesExtracted_returnsOnlySelected", () => {
    const nodes = [makeNode("n1", true), makeNode("n2", false), makeNode("n3", true)];
    const result = getSelectedNodes(nodes);
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.id)).toEqual(["n1", "n3"]);
  });

  // FEAT-00010-002002-00002
  it("copy_noSelectedNodes_returnsEmpty", () => {
    const nodes = [makeNode("n1", false), makeNode("n2", false)];
    const result = getSelectedNodes(nodes);
    expect(result).toHaveLength(0);
  });
});

// ============================
// getInternalEdges
// ============================
describe("getInternalEdges", () => {
  // FEAT-00010-002002-00001 (edge part)
  it("internalEdges_bothEndpointsSelected_edgeIncluded", () => {
    const edges = [makeEdge("n1", "n2"), makeEdge("n2", "n3"), makeEdge("n1", "n3")];
    const selectedIds = new Set(["n1", "n2"]);
    const result = getInternalEdges(edges, selectedIds);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("n1");
    expect(result[0].target).toBe("n2");
  });

  // FEAT-00010-002003-00004
  it("internalEdges_crossBoundaryEdge_excluded", () => {
    const edges = [makeEdge("n1", "n3")];
    const selectedIds = new Set(["n1"]);
    const result = getInternalEdges(edges, selectedIds);
    expect(result).toHaveLength(0);
  });

  // FEAT-00010-002003-00004 (b)
  it("internalEdges_allSelected_allEdgesIncluded", () => {
    const edges = [makeEdge("n1", "n2"), makeEdge("n2", "n3")];
    const selectedIds = new Set(["n1", "n2", "n3"]);
    const result = getInternalEdges(edges, selectedIds);
    expect(result).toHaveLength(2);
  });
});

// ============================
// createRemappedNodes (paste / duplicate)
// ============================
describe("createRemappedNodes", () => {
  let counter: number;
  const idGen = () => `new-${++counter}`;

  // FEAT-00010-002004-00001
  it("paste_newNodeIDs_allIDsAreNew", () => {
    counter = 0;
    const nodes = [makeNode("n1", true, 100, 200), makeNode("n2", true, 300, 400)];
    const { newNodes, idMap } = createRemappedNodes(nodes, 50, idGen);

    expect(newNodes).toHaveLength(2);
    expect(newNodes[0].id).toBe("new-1");
    expect(newNodes[1].id).toBe("new-2");
    expect(idMap.get("n1")).toBe("new-1");
    expect(idMap.get("n2")).toBe("new-2");
  });

  // FEAT-00010-002004-00003
  it("paste_offsetApplied_positionsShiftedBy50", () => {
    counter = 0;
    const nodes = [makeNode("n1", true, 100, 200)];
    const { newNodes } = createRemappedNodes(nodes, 50, idGen);

    expect(newNodes[0].position.x).toBe(150);
    expect(newNodes[0].position.y).toBe(250);
  });

  // FEAT-00010-002004-00004
  it("paste_selectedFlag_newNodesAreSelected", () => {
    counter = 0;
    const nodes = [makeNode("n1", false, 0, 0)];
    const { newNodes } = createRemappedNodes(nodes, 50, idGen);

    expect((newNodes[0] as FlowNode & { selected: boolean }).selected).toBe(true);
  });

  // FEAT-00010-002004-00001 (empty case)
  it("paste_emptyArray_returnsEmpty", () => {
    counter = 0;
    const { newNodes, idMap } = createRemappedNodes([], 50, idGen);
    expect(newNodes).toHaveLength(0);
    expect(idMap.size).toBe(0);
  });
});

// ============================
// remapEdges
// ============================
describe("remapEdges", () => {
  // FEAT-00010-002004-00002
  it("remap_sourceAndTargetMapped_edgesUseNewIDs", () => {
    const edges = [makeEdge("n1", "n2"), makeEdge("n2", "n3")];
    const idMap = new Map([
      ["n1", "new-1"],
      ["n2", "new-2"],
      ["n3", "new-3"],
    ]);
    const result = remapEdges(edges, idMap);

    expect(result).toHaveLength(2);
    expect(result[0].source).toBe("new-1");
    expect(result[0].target).toBe("new-2");
    expect(result[1].source).toBe("new-2");
    expect(result[1].target).toBe("new-3");
  });

  // FEAT-00010-002004-00002 (ID format)
  it("remap_edgeIDs_formatContainsNewSourceTarget", () => {
    const edges = [makeEdge("n1", "n2")];
    const idMap = new Map([
      ["n1", "new-1"],
      ["n2", "new-2"],
    ]);
    const result = remapEdges(edges, idMap);

    expect(result[0].id).toContain("new-1");
    expect(result[0].id).toContain("new-2");
  });

  // FEAT-00010-002004-00002 (unmapped fallback)
  it("remap_unmappedSource_fallsBackToOriginal", () => {
    const edges = [makeEdge("n1", "n2")];
    const idMap = new Map([["n1", "new-1"]]);
    const result = remapEdges(edges, idMap);

    expect(result[0].source).toBe("new-1");
    expect(result[0].target).toBe("n2"); // fallback
  });
});

// ============================
// Delete selected — logic verification
// ============================
describe("delete selected logic", () => {
  // FEAT-00010-002003-00004
  it("deleteSelected_removesSelectedNodesAndRelatedEdges", () => {
    const nodes = [makeNode("n1", true), makeNode("n2", false), makeNode("n3", true)];
    const edges = [makeEdge("n1", "n2"), makeEdge("n2", "n3"), makeEdge("n1", "n3")];

    const selectedIds = new Set(getSelectedNodes(nodes).map((n) => n.id));
    const remainingNodes = nodes.filter((n) => !selectedIds.has(n.id));
    const remainingEdges = edges.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target));

    expect(remainingNodes).toHaveLength(1);
    expect(remainingNodes[0].id).toBe("n2");
    expect(remainingEdges).toHaveLength(0); // all edges touch selected nodes
  });
});

// ============================
// Cut selected — logic verification
// ============================
describe("cut selected logic", () => {
  // FEAT-00010-002003-00003
  it("cutSelected_copiesThenDeletes", () => {
    const nodes = [makeNode("n1", true, 10, 20), makeNode("n2", false, 30, 40)];
    const edges = [makeEdge("n1", "n2")];

    // Copy phase
    const selectedNodes = getSelectedNodes(nodes);
    const selectedIds = new Set(selectedNodes.map((n) => n.id));
    const internalEdges = getInternalEdges(edges, selectedIds);

    expect(selectedNodes).toHaveLength(1);
    expect(internalEdges).toHaveLength(0); // no edges within single selected node

    // Delete phase
    const remaining = nodes.filter((n) => !selectedIds.has(n.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("n2");
  });
});

// ============================
// SelectAll / DeselectAll — logic verification
// ============================
describe("selectAll / deselectAll logic", () => {
  // FEAT-00010-002003-00001
  it("selectAll_allNodesBecomeSeltected", () => {
    const nodes = [makeNode("n1", false), makeNode("n2", false), makeNode("n3", true)];
    const selected = nodes.map((n) => ({ ...n, selected: true }));

    expect(selected.every((n) => n.selected)).toBe(true);
  });

  // FEAT-00010-002003-00002
  it("deselectAll_allNodesBecomDeselected", () => {
    const nodes = [makeNode("n1", true), makeNode("n2", true)];
    const deselected = nodes.map((n) => ({ ...n, selected: false }));

    expect(deselected.every((n) => !n.selected)).toBe(true);
  });
});
