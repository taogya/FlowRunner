// BD-03 フロー定義データモデル IT tests
// Trace: BD-03-005001 概要,
//        BD-03-005002 FlowDefinition,
//        BD-03-005003 NodeInstance,
//        BD-03-005004 EdgeInstance

import { describe, it, expect } from "vitest";
import type {
  FlowDefinition,
  NodeInstance,
  EdgeInstance,
  Position,
  NodeSettings,
} from "@shared/types/flow.js";

// --- BD-03-005001: フロー定義概要 ---

describe("Flow Data Model Overview (BD-03-005001)", () => {
  // BDIT-03-005001-00001
  it("flowDefinition_isJSONSerializable", () => {
    const flow: FlowDefinition = {
      id: "f1",
      name: "Test Flow",
      description: "A test",
      version: "1.0.0",
      nodes: [],
      edges: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const json = JSON.stringify(flow);
    const parsed: FlowDefinition = JSON.parse(json);

    expect(parsed).toEqual(flow);
  });
});

// --- BD-03-005002: FlowDefinition ---

describe("FlowDefinition (BD-03-005002)", () => {
  // BDIT-03-005002-00001
  it("flowDefinition_hasAllRequiredFields", () => {
    const flow: FlowDefinition = {
      id: "flow-1",
      name: "My Flow",
      description: "Description",
      version: "1.0.0",
      nodes: [],
      edges: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(flow.id).toBe("flow-1");
    expect(flow.name).toBe("My Flow");
    expect(flow.description).toBe("Description");
    expect(flow.version).toBe("1.0.0");
    expect(Array.isArray(flow.nodes)).toBe(true);
    expect(Array.isArray(flow.edges)).toBe(true);
    expect(flow.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(flow.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  // BDIT-03-005002-00002
  it("flowDefinition_containsNodesAndEdges", () => {
    const node: NodeInstance = {
      id: "n1",
      type: "trigger",
      label: "Start",
      enabled: true,
      position: { x: 0, y: 0 },
      settings: {},
    };
    const edge: EdgeInstance = {
      id: "e1",
      sourceNodeId: "n1",
      sourcePortId: "out",
      targetNodeId: "n2",
      targetPortId: "in",
    };
    const flow: FlowDefinition = {
      id: "f1",
      name: "Flow",
      description: "",
      version: "1.0.0",
      nodes: [node],
      edges: [edge],
      createdAt: "",
      updatedAt: "",
    };

    expect(flow.nodes).toHaveLength(1);
    expect(flow.edges).toHaveLength(1);
    expect(flow.nodes[0].id).toBe("n1");
    expect(flow.edges[0].sourceNodeId).toBe("n1");
  });
});

// --- BD-03-005003: NodeInstance ---

describe("NodeInstance (BD-03-005003)", () => {
  // BDIT-03-005003-00001
  it("nodeInstance_hasAllRequiredFields", () => {
    const node: NodeInstance = {
      id: "node-1",
      type: "command",
      label: "Run Command",
      enabled: true,
      position: { x: 100, y: 200 },
      settings: { command: "echo hello" },
    };

    expect(node.id).toBe("node-1");
    expect(node.type).toBe("command");
    expect(node.label).toBe("Run Command");
    expect(node.enabled).toBe(true);
    expect(node.position.x).toBe(100);
    expect(node.position.y).toBe(200);
    expect(node.settings).toEqual({ command: "echo hello" });
  });

  // BDIT-03-005003-00002
  it("nodeInstance_position_hasXAndY", () => {
    const pos: Position = { x: 50, y: 75 };
    expect(typeof pos.x).toBe("number");
    expect(typeof pos.y).toBe("number");
  });

  // BDIT-03-005003-00003
  it("nodeSettings_isKeyValuePairs", () => {
    const settings: NodeSettings = {
      command: "echo hello",
      cwd: "/tmp",
      timeout: 30,
    };
    expect(settings.command).toBe("echo hello");
    expect(settings.cwd).toBe("/tmp");
    expect(settings.timeout).toBe(30);
  });
});

// --- BD-03-005004: EdgeInstance ---

describe("EdgeInstance (BD-03-005004)", () => {
  // BDIT-03-005004-00001
  it("edgeInstance_hasAllRequiredFields", () => {
    const edge: EdgeInstance = {
      id: "e1",
      sourceNodeId: "n1",
      sourcePortId: "out",
      targetNodeId: "n2",
      targetPortId: "in",
    };

    expect(edge.id).toBe("e1");
    expect(edge.sourceNodeId).toBe("n1");
    expect(edge.sourcePortId).toBe("out");
    expect(edge.targetNodeId).toBe("n2");
    expect(edge.targetPortId).toBe("in");
  });

  // BDIT-03-005004-00002
  it("edgeInstance_connectsSourceToTarget", () => {
    const edge: EdgeInstance = {
      id: "e1",
      sourceNodeId: "trigger-1",
      sourcePortId: "out",
      targetNodeId: "command-1",
      targetPortId: "in",
    };

    // Edge connects from source output port to target input port
    expect(edge.sourceNodeId).not.toBe(edge.targetNodeId);
    expect(edge.sourcePortId).toBe("out");
    expect(edge.targetPortId).toBe("in");
  });
});
