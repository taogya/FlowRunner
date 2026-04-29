// FEAT-00009 Auto Layout UT tests — DagreLayoutEngine
// Trace: FEAT-00009-002001, FEAT-00009-002002

import { describe, it, expect } from "vitest";
import { DagreLayoutEngine } from "@webview/services/DagreLayoutEngine.js";
import type { LayoutNode, LayoutEdge, LayoutOptions } from "@webview/interfaces/ILayoutEngine.js";

function defaultOptions(overrides: Partial<LayoutOptions> = {}): LayoutOptions {
  return {
    direction: "LR",
    nodeSpacing: 50,
    rankSpacing: 100,
    ...overrides,
  };
}

function makeNode(id: string, x = 0, y = 0): LayoutNode {
  return { id, position: { x, y }, width: 160, height: 60 };
}

function makeEdge(source: string, target: string): LayoutEdge {
  return { source, target };
}

// ============================
// DagreLayoutEngine.layout — basic
// ============================
describe("DagreLayoutEngine", () => {
  const engine = new DagreLayoutEngine();

  // FEAT-00009-002002-00001
  it("layout_singleNode_returnsNodeWithPosition", () => {
    const nodes = [makeNode("n1")];
    const result = engine.layout(nodes, [], defaultOptions());

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("n1");
    expect(typeof result[0].position.x).toBe("number");
    expect(typeof result[0].position.y).toBe("number");
  });

  // FEAT-00009-002002-00002
  it("layout_twoConnectedNodes_LR_secondNodeHasLargerX", () => {
    const nodes = [makeNode("n1"), makeNode("n2")];
    const edges = [makeEdge("n1", "n2")];
    const result = engine.layout(nodes, edges, defaultOptions());

    const n1 = result.find((n) => n.id === "n1")!;
    const n2 = result.find((n) => n.id === "n2")!;
    // In LR layout, n2 should be to the right of n1
    expect(n2.position.x).toBeGreaterThan(n1.position.x);
  });

  // FEAT-00009-002002-00003
  it("layout_twoConnectedNodes_TB_secondNodeHasLargerY", () => {
    const nodes = [makeNode("n1"), makeNode("n2")];
    const edges = [makeEdge("n1", "n2")];
    const result = engine.layout(nodes, edges, defaultOptions({ direction: "TB" }));

    const n1 = result.find((n) => n.id === "n1")!;
    const n2 = result.find((n) => n.id === "n2")!;
    // In TB layout, n2 should be below n1
    expect(n2.position.y).toBeGreaterThan(n1.position.y);
  });

  // FEAT-00009-002002-00004
  it("layout_noNodesNoEdges_returnsEmptyArray", () => {
    const result = engine.layout([], [], defaultOptions());
    expect(result).toEqual([]);
  });

  // FEAT-00009-002002-00005
  it("layout_nodesWithoutEdges_allNodesReturnedWithPositions", () => {
    const nodes = [makeNode("n1"), makeNode("n2"), makeNode("n3")];
    const result = engine.layout(nodes, [], defaultOptions());

    expect(result).toHaveLength(3);
    for (const node of result) {
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });

  // FEAT-00009-002002-00006
  it("layout_nodesDoNotOverlap_LR", () => {
    const nodes = [makeNode("n1"), makeNode("n2"), makeNode("n3")];
    const edges = [makeEdge("n1", "n2"), makeEdge("n2", "n3")];
    const result = engine.layout(nodes, edges, defaultOptions());

    // Check no two nodes overlap
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const overlapX = a.position.x < b.position.x + b.width && b.position.x < a.position.x + a.width;
        const overlapY = a.position.y < b.position.y + b.height && b.position.y < a.position.y + a.height;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });

  // FEAT-00009-002002-00007
  it("layout_preservesNodeIdAndDimensions", () => {
    const nodes = [makeNode("n1"), makeNode("n2")];
    const edges = [makeEdge("n1", "n2")];
    const result = engine.layout(nodes, edges, defaultOptions());

    for (const node of result) {
      expect(node.width).toBe(160);
      expect(node.height).toBe(60);
      expect(["n1", "n2"]).toContain(node.id);
    }
  });

  // FEAT-00009-002002-00008
  it("layout_returnsSameNodeCount", () => {
    const nodes = [makeNode("n1"), makeNode("n2"), makeNode("n3"), makeNode("n4")];
    const edges = [makeEdge("n1", "n2"), makeEdge("n1", "n3"), makeEdge("n3", "n4")];
    const result = engine.layout(nodes, edges, defaultOptions());
    expect(result).toHaveLength(4);
  });

  // FEAT-00009-002002-00009
  it("layout_branchingGraph_parallelNodesHaveSameX_LR", () => {
    // n1 -> n2, n1 -> n3 (branching)
    const nodes = [makeNode("n1"), makeNode("n2"), makeNode("n3")];
    const edges = [makeEdge("n1", "n2"), makeEdge("n1", "n3")];
    const result = engine.layout(nodes, edges, defaultOptions());

    const n2 = result.find((n) => n.id === "n2")!;
    const n3 = result.find((n) => n.id === "n3")!;
    // In LR layout, branching nodes should be at the same rank (similar x)
    expect(Math.abs(n2.position.x - n3.position.x)).toBeLessThan(1);
  });

  // FEAT-00009-002002-00010
  it("layout_convertsFromCenterToTopLeftCoordinates", () => {
    // Dagre returns center coordinates; DagreLayoutEngine should convert to top-left
    const nodes = [makeNode("n1")];
    const result = engine.layout(nodes, [], defaultOptions());

    // Position should be top-left (not center), so we verify x and y aren't NaN
    expect(Number.isFinite(result[0].position.x)).toBe(true);
    expect(Number.isFinite(result[0].position.y)).toBe(true);
    // For a single node, dagre places it at center. After adjustment:
    // x = center_x - width/2, y = center_y - height/2
    // Both should be 0 for a single node centered at (80, 30)
    expect(result[0].position.x).toBe(0);
    expect(result[0].position.y).toBe(0);
  });
});
