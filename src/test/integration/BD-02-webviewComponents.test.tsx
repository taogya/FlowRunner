// @vitest-environment jsdom
// BD-02 WebView Component Integration Tests
// Trace: BD-02-004001 コンポーネント階層, BD-02-004002 FlowEditorApp,
//        BD-02-004003 Toolbar, BD-02-004004 NodePalette,
//        BD-02-004005 FlowCanvas, BD-02-004006 PropertyPanel

import { describe, it, expect, vi } from "vitest";

// Mock @xyflow/react for jsdom environment
vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: unknown }) => children,
  ReactFlow: () => null,
  MiniMap: () => null,
  Controls: () => null,
  Background: () => null,
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  useReactFlow: () => ({ screenToFlowPosition: (pos: { x: number; y: number }) => pos }),
  applyNodeChanges: (_changes: unknown[], nodes: unknown[]) => nodes,
  applyEdgeChanges: (_changes: unknown[], edges: unknown[]) => edges,
}));

// Mock MessageClient
vi.mock("@webview/services/MessageClient.js", () => ({
  MessageClient: class {
    send = vi.fn();
    onMessage = vi.fn().mockReturnValue({ dispose: vi.fn() });
  },
  messageClient: {
    send: vi.fn(),
    onMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
}));

// Import all WebView components to verify hierarchy
import { FlowEditorApp } from "@webview/components/FlowEditorApp.js";
import { Toolbar } from "@webview/components/Toolbar.js";
import { NodePalette } from "@webview/components/NodePalette.js";
import { FlowCanvas } from "@webview/components/FlowCanvas.js";
import { PropertyPanel } from "@webview/components/PropertyPanel.js";
import { MessageClient } from "@webview/services/MessageClient.js";

// State types from FlowEditorApp
import {
  initialState,
  flowEditorReducer,
} from "@webview/components/FlowEditorApp.js";
import type { FlowEditorAction } from "@webview/components/FlowEditorApp.js";

// --- BD-02-004001: コンポーネント階層 ---

describe("WebView Component Hierarchy (BD-02-004001)", () => {
  // BDIT-02-004001-00001
  it("allWebViewComponents_areExported", () => {
    expect(FlowEditorApp).toBeDefined();
    expect(Toolbar).toBeDefined();
    expect(NodePalette).toBeDefined();
    expect(FlowCanvas).toBeDefined();
    expect(PropertyPanel).toBeDefined();
    expect(MessageClient).toBeDefined();
  });

  // BDIT-02-004001-00002
  it("allWebViewComponents_areFunctions", () => {
    // React components are functions
    expect(typeof FlowEditorApp).toBe("function");
    expect(typeof Toolbar).toBe("function");
    expect(typeof NodePalette).toBe("function");
    expect(typeof FlowCanvas).toBe("function");
    expect(typeof PropertyPanel).toBe("function");
  });
});

// --- BD-02-004002: FlowEditorApp ---

describe("FlowEditorApp (BD-02-004002)", () => {
  // BDIT-02-004002-00001
  it("initialState_hasRequiredFields", () => {
    expect(initialState.nodes).toBeDefined();
    expect(initialState.edges).toBeDefined();
    expect(initialState.selectedNodeId).toBeDefined();
    expect(Array.isArray(initialState.nodes)).toBe(true);
    expect(Array.isArray(initialState.edges)).toBe(true);
  });

  // BDIT-02-004002-00002
  it("reducer_handlesFlowLoadedMessage", () => {
    const action: FlowEditorAction = {
      type: "FLOW_LOADED",
      nodes: [{ id: "n1", type: "command", position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    };

    const state = flowEditorReducer(initialState, action);

    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe("n1");
  });

  // BDIT-02-004002-00003
  it("reducer_handlesNodeExecStateMessages", () => {
    // Setup state with a node
    let state = flowEditorReducer(initialState, {
      type: "FLOW_LOADED",
      nodes: [{ id: "n1", type: "command", position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    });

    // Node execution state change
    state = flowEditorReducer(state, {
      type: "NODE_EXEC_STATE",
      nodeId: "n1",
      state: "running",
    });

    expect(state.executionState).toBeDefined();
    expect(state.executionState.get("n1")).toBe("running");
  });
});

// --- BD-02-004003: Toolbar ---

describe("Toolbar (BD-02-004003)", () => {
  // BDIT-02-004003-00001
  it("toolbar_isReactComponent", () => {
    expect(typeof Toolbar).toBe("function");
  });
});

// --- BD-02-004004: NodePalette ---

describe("NodePalette (BD-02-004004)", () => {
  // BDIT-02-004004-00001
  it("nodePalette_isReactComponent", () => {
    expect(typeof NodePalette).toBe("function");
  });
});

// --- BD-02-004005: FlowCanvas ---

describe("FlowCanvas (BD-02-004005)", () => {
  // BDIT-02-004005-00001
  it("flowCanvas_isReactComponent", () => {
    expect(typeof FlowCanvas).toBe("function");
  });
});

// --- BD-02-004006: PropertyPanel ---

describe("PropertyPanel (BD-02-004006)", () => {
  // BDIT-02-004006-00001
  it("propertyPanel_isReactComponent", () => {
    expect(typeof PropertyPanel).toBe("function");
  });
});
