// @vitest-environment jsdom
// FEAT-00016 execution summary unit tests
// Trace: FEAT-00016-003001, FEAT-00016-003002, FEAT-00016-003003, FEAT-00016-003004

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeResult } from "@shared/types/execution.js";
import { LatestExecutionSummary } from "@webview/components/LatestExecutionSummary.js";
import { FlowEditorApp } from "@webview/components/FlowEditorApp.js";
import { createExecutionSummaryItem } from "@webview/services/executionSummary.js";

const mocks = vi.hoisted(() => ({
  messageHandler: null as ((msg: { type: string; payload: Record<string, unknown> }) => void) | null,
  messageClientSend: vi.fn(),
  messageClientOnMessage: vi.fn(),
  flowCanvasSpy: vi.fn(),
  propertyPanelSpy: vi.fn(),
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

vi.mock("@webview/components/Toolbar.js", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));

vi.mock("@webview/components/NodePalette.js", () => ({
  NodePalette: () => <div data-testid="node-palette" />,
}));

vi.mock("@webview/components/FlowCanvas.js", () => ({
  FlowCanvas: (props: Record<string, unknown>) => {
    mocks.flowCanvasSpy(props);
    const selectedNodeIds = ((props.nodes as Array<{ id: string; selected?: boolean }> | undefined) ?? [])
      .filter((node) => node.selected)
      .map((node) => node.id)
      .join(",");
    return (
      <div
        data-testid="flow-canvas"
        data-focused-node-id={String(props.focusedNodeId ?? "")}
        data-selected-node-ids={selectedNodeIds}
      />
    );
  },
}));

vi.mock("@webview/components/PropertyPanel.js", () => ({
  PropertyPanel: (props: Record<string, unknown>) => {
    mocks.propertyPanelSpy(props);
    const selectedNode = props.selectedNode as { id?: string } | null | undefined;
    return <div data-testid="property-panel-selected">{selectedNode?.id ?? "none"}</div>;
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
    nodeId: "node-1",
    nodeType: "command",
    nodeLabel: "Run Command",
    status: "success",
    inputs: {},
    outputs: { stdout: "hello\nworld" },
    duration: 123,
    ...overrides,
  };
}

describe("Execution Summary (FEAT-00016)", () => {
  beforeEach(() => {
    mocks.messageHandler = null;
    mocks.messageClientSend.mockReset();
    mocks.messageClientOnMessage.mockReset();
    mocks.flowCanvasSpy.mockReset();
    mocks.propertyPanelSpy.mockReset();
    mocks.messageClientOnMessage.mockImplementation(
      (handler: (msg: { type: string; payload: Record<string, unknown> }) => void) => {
        mocks.messageHandler = handler;
        return { dispose: vi.fn() };
      },
    );
  });

  // FEAT-00016-003001-00001
  it("createExecutionSummaryItem_buildsOrderedSummary", () => {
    const item = createExecutionSummaryItem(createResult(), 2);

    expect(item).toEqual(
      expect.objectContaining({
        nodeId: "node-1",
        label: "Run Command",
        executionOrder: 2,
        durationMs: 123,
        summaryText: "hello world",
        hasError: false,
      }),
    );
  });

  // FEAT-00016-003002-00001
  it("summaryRendersStatusDurationAndSummaryText", () => {
    render(<LatestExecutionSummary items={[createExecutionSummaryItem(createResult(), 1)]} />);

    expect(screen.getByText("Run Command")).toBeDefined();
    expect(screen.getByText("Success")).toBeDefined();
    expect(screen.getByText("123ms")).toBeDefined();
    expect(screen.getByText("hello world")).toBeDefined();
  });

  // FEAT-00016-003002-00003
  it("summaryCanCollapse_withoutKeepingListVisible", () => {
    render(<LatestExecutionSummary items={[createExecutionSummaryItem(createResult(), 1)]} />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));

    expect(screen.queryByText("hello world")).toBeNull();
    expect(screen.getByRole("button", { name: "Expand" })).toBeDefined();
  });

  // FEAT-00016-003002-00002
  it("noItems_showsEmptyState", () => {
    render(<LatestExecutionSummary items={[]} />);

    expect(screen.getByText("No execution summary yet")).toBeDefined();
  });

  // FEAT-00016-003003-00001
  it("errorItem_isHighlightedAndUsesErrorSummary", () => {
    const item = createExecutionSummaryItem(
      createResult({
        nodeId: "node-2",
        nodeLabel: "Failing Command",
        status: "error",
        outputs: { stdout: "ignored output" },
        error: { message: "command failed with exit code 1" },
      }),
      1,
    );

    render(<LatestExecutionSummary items={[item]} />);

    const row = screen.getByText("Failing Command").closest("button");
    expect(row?.className).toContain("fr-summary-item--error");
    expect(screen.getByText("command failed with exit code 1")).toBeDefined();
    expect(screen.queryByText("ignored output")).toBeNull();
  });

  // FEAT-00016-003003-00002
  it("errorsOnlyFilter_showsOnlyFailedItems", () => {
    const successItem = createExecutionSummaryItem(createResult(), 1);
    const errorItem = createExecutionSummaryItem(
      createResult({
        nodeId: "node-2",
        nodeLabel: "Failing Command",
        status: "error",
        error: { message: "boom" },
      }),
      2,
    );

    render(<LatestExecutionSummary items={[successItem, errorItem]} />);
    fireEvent.click(screen.getByRole("button", { name: "Errors Only" }));

    expect(screen.queryByText("Run Command")).toBeNull();
    expect(screen.getByText("Failing Command")).toBeDefined();
  });

  // FEAT-00016-003004-00001
  it("summaryClick_selectsNodeAndRequestsCanvasFocus", () => {
    render(<FlowEditorApp />);

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          nodes: [
            {
              id: "node-1",
              type: "command",
              position: { x: 120, y: 160 },
              data: { label: "Run Command", settings: {} },
            },
          ],
          edges: [],
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "execution:nodeCompleted",
        payload: {
          nodeId: "node-1",
          result: createResult(),
        },
      });
    });

    fireEvent.click(screen.getByText("Run Command"));

    expect(screen.getByTestId("property-panel-selected").textContent).toBe("node-1");
    expect(screen.getByTestId("flow-canvas").getAttribute("data-focused-node-id")).toBe(
      "node-1",
    );
    expect(screen.getByTestId("flow-canvas").getAttribute("data-selected-node-ids")).toBe(
      "node-1",
    );
  });

  // FEAT-00016-003004-00002
  it("disabledNodeBetweenExecutions_keepsLaterSummaryItemsVisible", () => {
    render(<FlowEditorApp />);

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          nodes: [
            {
              id: "trigger",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: { label: "TTrigger", settings: {} },
            },
            {
              id: "disabled",
              type: "transform",
              position: { x: 120, y: 0 },
              data: { label: "Disabled", enabled: false, settings: {} },
            },
            {
              id: "after-disabled",
              type: "log",
              position: { x: 240, y: 0 },
              data: { label: "After Disabled", settings: {} },
            },
          ],
          edges: [],
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "execution:nodeCompleted",
        payload: {
          nodeId: "trigger",
          result: createResult({
            nodeId: "trigger",
            nodeType: "trigger",
            nodeLabel: "TTrigger",
            outputs: {},
          }),
        },
      });
      mocks.messageHandler?.({
        type: "execution:nodeCompleted",
        payload: {
          nodeId: "after-disabled",
          result: createResult({
            nodeId: "after-disabled",
            nodeType: "log",
            nodeLabel: "After Disabled",
            outputs: { out: "after disabled" },
          }),
        },
      });
    });

    expect(screen.getByText("TTrigger")).toBeDefined();
    expect(screen.getByText("After Disabled")).toBeDefined();
    expect(screen.getByText("after disabled")).toBeDefined();
  });
});