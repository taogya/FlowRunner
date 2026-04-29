// @vitest-environment jsdom
// FEAT-00020 flow dependency view unit tests
// Trace: FEAT-00020-003002, FEAT-00020-003003, FEAT-00020-003004, FEAT-00020-003005

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlowDependencyPanel } from "@webview/components/FlowDependencyPanel.js";
import { FlowEditorApp } from "@webview/components/FlowEditorApp.js";
import type { FlowDependencySnapshot } from "@shared/types/dependencies.js";

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

vi.mock("@webview/components/Toolbar.js", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));

vi.mock("@webview/components/NodePalette.js", () => ({
  NodePalette: () => <div data-testid="node-palette" />,
}));

vi.mock("@webview/components/FlowCanvas.js", () => ({
  FlowCanvas: () => <div data-testid="flow-canvas" />,
}));

vi.mock("@webview/components/PropertyPanel.js", () => ({
  PropertyPanel: () => <div data-testid="property-panel" />,
}));

vi.mock("@webview/components/LatestExecutionSummary.js", () => ({
  LatestExecutionSummary: () => <div data-testid="latest-summary" />,
}));

vi.mock("@webview/components/ExecutionAnalyticsPanel.js", () => ({
  ExecutionAnalyticsPanel: () => <div data-testid="execution-analytics" />,
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

function createSnapshot(): FlowDependencySnapshot {
  return {
    flowId: "main",
    flowName: "Main Flow",
    outgoing: [
      {
        flowId: "child-1",
        flowName: "Child Flow",
        nodeCount: 2,
        nodeReferences: [
          { nodeId: "sub-1", nodeLabel: "Call Child" },
          { nodeId: "sub-2", nodeLabel: "Call Child Again" },
        ],
      },
    ],
    incoming: [
      {
        flowId: "parent-1",
        flowName: "Parent Flow",
        nodeCount: 1,
        nodeReferences: [
          { nodeId: "sub-parent", nodeLabel: "Call Main" },
        ],
      },
    ],
    warnings: [
      {
        sourceFlowId: "main",
        sourceFlowName: "Main Flow",
        nodeId: "sub-missing",
        nodeLabel: "Broken Child",
        referencedFlowId: "ghost",
        kind: "missingTarget",
      },
    ],
  };
}

function countDependencyLoadRequests(): number {
  return mocks.messageClientSend.mock.calls.filter(
    (call) => call[0] === "dependency:load",
  ).length;
}

describe("FEAT-00020 flow dependency view", () => {
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

  // FEAT-00020-003005-00002
  it("panel_emptySnapshot_showsEmptyState", () => {
    render(<FlowDependencyPanel snapshot={null} />);

    expect(screen.getByText("Flow Dependencies")).toBeDefined();
    expect(screen.getByText("This flow has no subflow dependencies or warnings.")).toBeDefined();
  });

  // FEAT-00020-003002-00002
  it("panel_snapshot_rendersOutgoingIncomingAndWarnings", () => {
    render(<FlowDependencyPanel snapshot={createSnapshot()} />);

    expect(screen.getByText("Child Flow")).toBeDefined();
    expect(screen.getByText("Parent Flow")).toBeDefined();
    expect(screen.getByText("Broken Child")).toBeDefined();
  });

  // FEAT-00020-003005-00003
  it("flowEditorApp_flowLoadedAndIndexChanged_requestDependencyReload", () => {
    render(<FlowEditorApp />);

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          flow: { id: "main", nodes: [], edges: [] },
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "flow:indexChanged",
        payload: {},
      });
    });

    expect(countDependencyLoadRequests()).toBe(2);
  });

  // FEAT-00020-003004-00001
  it("flowEditorApp_dependencyItemClick_opensTargetFlow", () => {
    render(<FlowEditorApp />);

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          flow: { id: "main", nodes: [], edges: [] },
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "dependency:loaded",
        payload: {
          flowId: "main",
          snapshot: createSnapshot(),
        },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Child Flow/i }));

    expect(mocks.messageClientSend).toHaveBeenCalledWith("dependency:openFlow", {
      targetFlowId: "child-1",
    });
  });
});