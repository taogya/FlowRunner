// DD-04 ExecutionService helper functions UT tests
// Trace: DD-04-002003 topologicalSort, DD-04-002005 buildInputs

import { describe, it, expect } from "vitest";
import { topologicalSort, buildInputs } from "@extension/services/executionHelpers.js";
import type { NodeInstance, EdgeInstance, PortDataMap } from "@shared/types/flow.js";

// --- Test helpers ---

function node(id: string, label = id): NodeInstance {
  return { id, type: "command", label, enabled: true, position: { x: 0, y: 0 }, settings: {} };
}

function edge(src: string, srcPort: string, tgt: string, tgtPort: string): EdgeInstance {
  return { id: `${src}-${tgt}`, sourceNodeId: src, sourcePortId: srcPort, targetNodeId: tgt, targetPortId: tgtPort };
}

// --- topologicalSort (DD-04-002003) ---

describe("topologicalSort", () => {
  // DDUT-04-002003-00001
  it("linearChain_returnsCorrectOrder", () => {
    // Arrange
    const nodes = [node("A"), node("B"), node("C")];
    const edges = [edge("A", "out", "B", "in"), edge("B", "out", "C", "in")];

    // Act
    const sorted = topologicalSort(nodes, edges);

    // Assert
    expect(sorted.map((n) => n.id)).toEqual(["A", "B", "C"]);
  });

  // DDUT-04-002003-00002
  it("singleNode_returnsThatNode", () => {
    // Arrange
    const nodes = [node("A")];
    const edges: EdgeInstance[] = [];

    // Act
    const sorted = topologicalSort(nodes, edges);

    // Assert
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("A");
  });

  // DDUT-04-002003-00003
  it("diamondShape_returnsValidTopologicalOrder", () => {
    // Arrange — A → B, A → C, B → D, C → D
    const nodes = [node("A"), node("B"), node("C"), node("D")];
    const edges = [
      edge("A", "out", "B", "in"),
      edge("A", "out", "C", "in"),
      edge("B", "out", "D", "in"),
      edge("C", "out", "D", "in"),
    ];

    // Act
    const sorted = topologicalSort(nodes, edges);

    // Assert — A must come first, D must come last
    const ids = sorted.map((n) => n.id);
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"));
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("C"));
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("D"));
    expect(ids.indexOf("C")).toBeLessThan(ids.indexOf("D"));
  });

  // DDUT-04-002003-00004
  it("circularDependency_throwsError", () => {
    // Arrange — A → B → C → A (cycle)
    const nodes = [node("A"), node("B"), node("C")];
    const edges = [
      edge("A", "out", "B", "in"),
      edge("B", "out", "C", "in"),
      edge("C", "out", "A", "in"),
    ];

    // Act & Assert
    expect(() => topologicalSort(nodes, edges)).toThrow("Circular dependency detected in flow");
  });

  // DDUT-04-002003-00005
  it("disconnectedNodes_returnsAllNodes", () => {
    // Arrange — A, B, C with no edges
    const nodes = [node("A"), node("B"), node("C")];
    const edges: EdgeInstance[] = [];

    // Act
    const sorted = topologicalSort(nodes, edges);

    // Assert
    expect(sorted).toHaveLength(3);
  });
});

// --- buildInputs (DD-04-002005) ---

describe("buildInputs", () => {
  // DDUT-04-002005-00001
  it("singleEdge_mapsDataCorrectly", () => {
    // Arrange
    const edges = [edge("A", "out", "B", "in")];
    const outputMap = new Map<string, PortDataMap>([["A", { out: "hello" }]]);

    // Act
    const inputs = buildInputs("B", edges, outputMap);

    // Assert
    expect(inputs.in).toBe("hello");
  });

  // DDUT-04-002005-00002
  it("multipleEdgesToSameTarget_mapsAllPorts", () => {
    // Arrange
    const edges = [
      edge("A", "out1", "C", "in1"),
      edge("B", "out1", "C", "in2"),
    ];
    const outputMap = new Map<string, PortDataMap>([
      ["A", { out1: "fromA" }],
      ["B", { out1: "fromB" }],
    ]);

    // Act
    const inputs = buildInputs("C", edges, outputMap);

    // Assert
    expect(inputs.in1).toBe("fromA");
    expect(inputs.in2).toBe("fromB");
  });

  // DDUT-04-002005-00003
  it("noConnectedEdges_returnsEmptyMap", () => {
    // Arrange
    const edges = [edge("A", "out", "B", "in")];
    const outputMap = new Map<string, PortDataMap>();

    // Act
    const inputs = buildInputs("C", edges, outputMap);

    // Assert
    expect(Object.keys(inputs)).toHaveLength(0);
  });

  // DDUT-04-002005-00004
  it("sourceHasNoOutput_returnsUndefinedForPort", () => {
    // Arrange
    const edges = [edge("A", "out", "B", "in")];
    const outputMap = new Map<string, PortDataMap>(); // A has no output

    // Act
    const inputs = buildInputs("B", edges, outputMap);

    // Assert
    expect(inputs.in).toBeUndefined();
  });
});
