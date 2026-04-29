// @vitest-environment jsdom
// FEAT-00017 step debugging unit tests
// Trace: FEAT-00017-003002, FEAT-00017-003003, FEAT-00017-003004, FEAT-00017-003005

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeResult } from "@shared/types/execution.js";
import { FlowEditorApp } from "@webview/components/FlowEditorApp.js";

const mocks = vi.hoisted(() => ({
  messageHandler: null as ((msg: { type: string; payload: Record<string, unknown> }) => void) | null,
  messageClientSend: vi.fn(),
  messageClientOnMessage: vi.fn(),
}));

vi.mock("@vscode/l10n", () => ({
  t: (message: string, ...args: unknown[]) =>
    args.reduce(
      (text, value, index) => text.replace(`{${index}}`, String(value)),
      message,
    ),
}));

vi.mock("@webview/services/MessageClient.js", () => ({
  messageClient: {
    send: mocks.messageClientSend,
    onMessage: mocks.messageClientOnMessage,
  },
}));

vi.mock("@webview/components/FlowCanvas.js", () => ({
  FlowCanvas: (props: Record<string, unknown>) => {
    const nodes = (props.nodes as Array<{
      id: string;
      selected?: boolean;
      data?: { label?: string; debugPaused?: boolean };
    }> | undefined) ?? [];
    const pausedNodeIds = nodes
      .filter((node) => node.data?.debugPaused)
      .map((node) => node.id)
      .join(",");
    const selectedNodeIds = nodes
      .filter((node) => node.selected)
      .map((node) => node.id)
      .join(",");

    return (
      <div
        data-testid="flow-canvas"
        data-paused-node-ids={pausedNodeIds}
        data-selected-node-ids={selectedNodeIds}
      >
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            data-testid={`node-${node.id}`}
            onClick={() => (props.onNodeClick as ((nodeId: string) => void) | undefined)?.(node.id)}
          >
            {node.data?.label ?? node.id}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock("@webview/components/PropertyPanel.js", () => ({
  PropertyPanel: (props: Record<string, unknown>) => {
    const selectedNode = props.selectedNode as { id?: string } | null | undefined;
    const executionOutput = props.executionOutput as { nodeId?: string } | null | undefined;
    const inputPreview = props.inputPreview as { nodeId?: string; inputs?: Record<string, unknown> } | null | undefined;
    return (
      <div
        data-testid="property-panel"
        data-selected-node-id={selectedNode?.id ?? ""}
        data-output-node-id={executionOutput?.nodeId ?? ""}
        data-input-preview-node-id={inputPreview?.nodeId ?? ""}
        data-input-preview-json={inputPreview ? JSON.stringify(inputPreview.inputs ?? {}) : ""}
      />
    );
  },
}));

vi.mock("@webview/components/NodePalette.js", () => ({
  NodePalette: () => <div data-testid="node-palette" />,
}));

vi.mock("@webview/components/LatestExecutionSummary.js", () => ({
  LatestExecutionSummary: (props: Record<string, unknown>) => {
    const items = (props.items as Array<{ label: string; executionOrder: number }> | undefined) ?? [];
    return (
      <div
        data-testid="latest-execution-summary"
        data-summary-count={String(items.length)}
        data-summary-labels={items.map((item) => `${item.executionOrder}:${item.label}`).join("|")}
      />
    );
  },
}));

vi.mock("@webview/hooks/useUndoRedo.js", () => ({
  useUndoRedo: () => ({
    pushState: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
  }),
}));

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  applyNodeChanges: (_changes: unknown[], nodes: unknown[]) => nodes,
  applyEdgeChanges: (_changes: unknown[], edges: unknown[]) => edges,
}));

function createResult(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    nodeId: "trigger",
    nodeType: "trigger",
    nodeLabel: "Trigger",
    status: "success",
    inputs: {},
    outputs: { out: "ok" },
    duration: 5,
    ...overrides,
  };
}

function emitMessage(type: string, payload: Record<string, unknown>): void {
  act(() => {
    mocks.messageHandler?.({ type, payload });
  });
}

describe("Step Debugging (FEAT-00017)", () => {
  beforeEach(() => {
    mocks.messageHandler = null;
    mocks.messageClientSend.mockReset();
    mocks.messageClientOnMessage.mockReset();
    mocks.messageClientOnMessage.mockImplementation(
      (handler: (msg: { type: string; payload: Record<string, unknown> }) => void) => {
        mocks.messageHandler = handler;
        return { dispose: vi.fn() };
      },
    );
  });

  function loadSimpleFlow(): void {
    emitMessage("flow:loaded", {
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { label: "Trigger", settings: { triggerType: "manual" } },
        },
        {
          id: "command",
          type: "command",
          position: { x: 220, y: 0 },
          data: { label: "Run Command", settings: { command: "echo hi" } },
        },
      ],
      edges: [],
    });
  }

  // FEAT-00017-003002-00001
  it("debugPause_entersDebugModeAtCurrentNode", () => {
    render(<FlowEditorApp />);
    loadSimpleFlow();

    emitMessage("debug:paused", {
      nextNodeId: "trigger",
      intermediateResults: {},
    });

    expect(screen.getByText("Paused: Trigger")).toBeDefined();
    expect(screen.getByRole("button", { name: "Step" })).toBeDefined();
    expect(screen.getByTestId("flow-canvas").getAttribute("data-paused-node-ids")).toBe(
      "trigger",
    );
    expect(screen.getByTestId("property-panel").getAttribute("data-selected-node-id")).toBe(
      "trigger",
    );
  });

  // FEAT-00017-003003-00001
  it("nextPause_movesCurrentNodeHighlight", () => {
    render(<FlowEditorApp />);
    loadSimpleFlow();

    emitMessage("debug:paused", {
      nextNodeId: "command",
      intermediateResults: {
        trigger: createResult(),
      },
    });

    expect(screen.getByText("Paused: Run Command")).toBeDefined();
    expect(screen.getByTestId("flow-canvas").getAttribute("data-paused-node-ids")).toBe(
      "command",
    );
    expect(screen.getByTestId("flow-canvas").getAttribute("data-selected-node-ids")).toBe(
      "command",
    );
  });

  // FEAT-00017-003004-00001
  it("executedNodeSelection_showsIntermediateResults", () => {
    render(<FlowEditorApp />);
    loadSimpleFlow();

    emitMessage("debug:paused", {
      nextNodeId: "command",
      pausedInputPreview: {
        nodeId: "command",
        nodeType: "command",
        nodeLabel: "Run Command",
        inputs: { input: "ok" },
      },
      intermediateResults: {
        trigger: createResult(),
      },
    });

    expect(screen.getByTestId("property-panel").getAttribute("data-input-preview-node-id")).toBe(
      "command",
    );
    expect(screen.getByTestId("property-panel").getAttribute("data-input-preview-json")).toContain(
      '"input":"ok"',
    );

    fireEvent.click(screen.getByTestId("node-trigger"));

    expect(screen.getByTestId("property-panel").getAttribute("data-selected-node-id")).toBe(
      "trigger",
    );
    expect(screen.getByTestId("property-panel").getAttribute("data-output-node-id")).toBe(
      "trigger",
    );
    expect(screen.getByTestId("property-panel").getAttribute("data-input-preview-node-id")).toBe(
      "",
    );
    expect(screen.getByTestId("flow-canvas").getAttribute("data-paused-node-ids")).toBe(
      "command",
    );
  });

  // FEAT-00017-003003-00002
  it("debugPause_appendsLatestExecutionSummaryAsStepsAdvance", () => {
    render(<FlowEditorApp />);
    loadSimpleFlow();

    emitMessage("debug:paused", {
      nextNodeId: "command",
      intermediateResults: {
        trigger: createResult(),
      },
    });

    expect(screen.getByTestId("latest-execution-summary").getAttribute("data-summary-count")).toBe(
      "1",
    );
    expect(screen.getByTestId("latest-execution-summary").getAttribute("data-summary-labels")).toBe(
      "1:Trigger",
    );

    emitMessage("debug:paused", {
      nextNodeId: undefined,
      intermediateResults: {
        trigger: createResult(),
        command: createResult({
          nodeId: "command",
          nodeType: "command",
          nodeLabel: "Run Command",
          outputs: { stdout: "done" },
        }),
      },
    });

    expect(screen.getByTestId("latest-execution-summary").getAttribute("data-summary-count")).toBe(
      "2",
    );
    expect(screen.getByTestId("latest-execution-summary").getAttribute("data-summary-labels")).toBe(
      "1:Trigger|2:Run Command",
    );
  });

  // FEAT-00017-003003-00003
  it("repeatedNodeExecution_appendsAnotherSummaryRow", () => {
    render(<FlowEditorApp />);
    loadSimpleFlow();

    emitMessage("debug:paused", {
      nextNodeId: "command",
      intermediateResults: {
        trigger: createResult({ outputs: { out: "first" }, duration: 5 }),
      },
    });

    emitMessage("debug:paused", {
      nextNodeId: "command",
      intermediateResults: {
        trigger: createResult({ outputs: { out: "second" }, duration: 8 }),
      },
    });

    expect(screen.getByTestId("latest-execution-summary").getAttribute("data-summary-count")).toBe(
      "2",
    );
    expect(screen.getByTestId("latest-execution-summary").getAttribute("data-summary-labels")).toBe(
      "1:Trigger|2:Trigger",
    );
  });

  // FEAT-00017-003005-00001
  it("debugStop_clearsPausedHighlightAndReturnsToolbar", () => {
    render(<FlowEditorApp />);
    loadSimpleFlow();

    emitMessage("debug:paused", {
      nextNodeId: "command",
      intermediateResults: {
        trigger: createResult(),
      },
    });

    emitMessage("debug:paused", {
      nextNodeId: undefined,
      intermediateResults: {
        trigger: createResult(),
        command: createResult({
          nodeId: "command",
          nodeType: "command",
          nodeLabel: "Run Command",
          outputs: { stdout: "done" },
        }),
      },
    });

    expect(screen.queryByText("Paused: Run Command")).toBeNull();
    expect(screen.queryByRole("button", { name: "Step" })).toBeNull();
    expect(screen.getByRole("button", { name: "Debug" })).toBeDefined();
    expect(screen.getByTestId("flow-canvas").getAttribute("data-paused-node-ids")).toBe("");
  });
});