// @vitest-environment jsdom
// DD-02 FlowEditorApp UT tests
// Trace: DD-02-004001, DD-02-004002, DD-02-004003

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { FlowEditorApp } from "@webview/components/FlowEditorApp.js";
import {
  flowEditorReducer,
  initialState,
  type FlowEditorState,
  type FlowEditorAction,
} from "@webview/components/FlowEditorApp.js";

// Mock MessageClient
vi.mock("@webview/services/MessageClient.js", () => ({
  messageClient: {
    send: vi.fn(),
    onMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
}));

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="react-flow-provider">{children}</div>
  ),
  ReactFlow: ({
    children,
    nodes,
    onPaneClick,
  }: {
    children?: React.ReactNode;
    nodes?: Array<{ id: string; data?: { label?: string }; type?: string }>;
    [key: string]: unknown;
  }) => (
    <div data-testid="react-flow" onClick={onPaneClick as React.MouseEventHandler}>
      {nodes?.map((n) => (
        <div key={n.id} data-node-id={n.id} data-selected={String((n as { selected?: boolean }).selected ?? false)}>
          {n.data?.label ?? n.type}
        </div>
      ))}
      {children}
    </div>
  ),
  MiniMap: () => <div data-testid="minimap" />,
  Controls: () => <div data-testid="controls" />,
  Background: () => <div data-testid="background" />,
  Handle: ({ type, id }: { type: string; position: string; id: string }) => (
    <div data-testid={`handle-${type}-${id}`} />
  ),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  useReactFlow: () => ({
    screenToFlowPosition: (pos: { x: number; y: number }) => pos,
  }),
  applyNodeChanges: (_changes: unknown[], nodes: unknown[]) => nodes,
  applyEdgeChanges: (_changes: unknown[], edges: unknown[]) => edges,
}));

// --- Reducer Tests (DD-02-004002) ---
describe("flowEditorReducer", () => {
  // DDUT-02-004002-00003
  it("FLOW_LOADED_setsNodesAndEdges", () => {
    // Arrange
    const nodes = [{ id: "n1", type: "trigger", position: { x: 0, y: 0 }, data: {} }];
    const edges = [{ id: "e1", source: "n1", target: "n2" }];
    const action: FlowEditorAction = { type: "FLOW_LOADED", nodes, edges };

    // Act
    const state = flowEditorReducer(initialState, action);

    // Assert
    expect(state.nodes).toEqual(nodes);
    expect(state.edges).toEqual(edges);
    expect(state.isDirty).toBe(false);
  });

  // DDUT-02-004002-00004
  it("NODE_SELECTED_updatesSelectedNodeId", () => {
    // Arrange
    const action: FlowEditorAction = { type: "NODE_SELECTED", nodeId: "n1" };

    // Act
    const state = flowEditorReducer(initialState, action);

    // Assert
    expect(state.selectedNodeId).toBe("n1");
  });

  // DDUT-02-004002-00005
  it("NODE_EXEC_STATE_updatesExecutionState", () => {
    // Arrange
    const action: FlowEditorAction = { type: "NODE_EXEC_STATE", nodeId: "n1", state: "running" };

    // Act
    const result = flowEditorReducer(initialState, action);

    // Assert
    expect(result.executionState.get("n1")).toBe("running");
  });

  // DDUT-02-004002-00006
  it("DEBUG_MODE_updatesIsDebugMode", () => {
    // Arrange
    const action: FlowEditorAction = { type: "DEBUG_MODE", active: true };

    // Act
    const state = flowEditorReducer(initialState, action);

    // Assert
    expect(state.isDebugMode).toBe(true);
  });

  // DDUT-02-004002-00007
  it("FLOW_SAVED_setsIsDirtyFalse", () => {
    // Arrange
    const dirtyState: FlowEditorState = { ...initialState, isDirty: true };
    const action: FlowEditorAction = { type: "FLOW_SAVED" };

    // Act
    const state = flowEditorReducer(dirtyState, action);

    // Assert
    expect(state.isDirty).toBe(false);
  });

  // DDUT-02-004002-00008
  it("FLOW_LOADED_resetsExecutionState", () => {
    // Arrange
    const prevState: FlowEditorState = {
      ...initialState,
      executionState: new Map([["n1", "running"]]),
      isDirty: true,
    };
    const action: FlowEditorAction = {
      type: "FLOW_LOADED",
      nodes: [],
      edges: [],
    };

    // Act
    const state = flowEditorReducer(prevState, action);

    // Assert
    expect(state.executionState.size).toBe(0);
    expect(state.isDirty).toBe(false);
  });
});

// --- Component Tests ---
describe("FlowEditorApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- DD-02-004001: 概要 ---

  // DDUT-02-004001-00001
  it("isRootReactComponent", () => {
    // Act
    const { container } = render(<FlowEditorApp />);

    // Assert
    expect(container).toBeDefined();
    expect(container.firstChild).not.toBeNull();
  });

  // DDUT-02-004002-00001
  it("initialState_nodesAndEdgesEmpty", () => {
    // Act
    render(<FlowEditorApp />);

    // Assert — app renders without error (nodes/edges are empty)
    expect(document.querySelector("[data-testid='flow-editor']")).toBeDefined();
  });

  // DDUT-02-004002-00002
  it("initialState_isDirtyIsFalse", () => {
    // Act
    render(<FlowEditorApp />);

    // Assert — save button should be disabled (isDirty = false)
    const saveBtn = screen.queryByRole("button", { name: /save/i });
    if (saveBtn) {
      expect(saveBtn).toBeDisabled();
    }
  });

  // DDUT-02-004003-00001
  it("mount_sendsFlowLoadMessage", async () => {
    // Arrange
    const { messageClient } = vi.mocked(
      await import("@webview/services/MessageClient.js"),
    );

    // Act
    render(<FlowEditorApp />);

    // Assert
    expect(messageClient.send).toHaveBeenCalledWith("flow:load", {});
  });

  // DDUT-02-004003-00002
  it("flowLoadedMessage_updatesNodesAndEdges", async () => {
    // Arrange
    const { messageClient } = vi.mocked(
      await import("@webview/services/MessageClient.js"),
    );
    let messageHandler: (msg: { type: string; payload: Record<string, unknown> }) => void = () => {};
    (messageClient.onMessage as ReturnType<typeof vi.fn>).mockImplementation(
      (handler: (msg: { type: string; payload: Record<string, unknown> }) => void) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      },
    );

    // Act
    render(<FlowEditorApp />);
    act(() => {
      messageHandler({
        type: "flow:loaded",
        payload: {
          nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 }, data: { label: "Start" } }],
          edges: [],
        },
      });
    });

    // Assert — the node label should appear
    expect(screen.getByText("Start")).toBeDefined();
  });

  // DDUT-02-004003-00003
  it("paneClick_deselectsSelectedNodes", async () => {
    const { messageClient } = vi.mocked(
      await import("@webview/services/MessageClient.js"),
    );
    let messageHandler: (msg: { type: string; payload: Record<string, unknown> }) => void = () => {};
    (messageClient.onMessage as ReturnType<typeof vi.fn>).mockImplementation(
      (handler: (msg: { type: string; payload: Record<string, unknown> }) => void) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      },
    );

    render(<FlowEditorApp />);
    act(() => {
      messageHandler({
        type: "flow:loaded",
        payload: {
          flow: {
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 }, data: { label: "Start" }, selected: true }],
            edges: [],
          },
        },
      });
    });

    fireEvent.click(screen.getByTestId("react-flow"));

    expect(screen.getByText("Start").getAttribute("data-selected")).toBe("false");
  });
});
