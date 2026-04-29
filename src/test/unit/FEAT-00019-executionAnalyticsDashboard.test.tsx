// @vitest-environment jsdom
// FEAT-00019 execution analytics dashboard unit tests
// Trace: FEAT-00019-003002, FEAT-00019-003003, FEAT-00019-003004, FEAT-00019-003005

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExecutionAnalyticsPanel } from "@webview/components/ExecutionAnalyticsPanel.js";
import { FlowEditorApp } from "@webview/components/FlowEditorApp.js";
import type { ExecutionAnalyticsSnapshot } from "@shared/types/analytics.js";

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

function createSnapshot(): ExecutionAnalyticsSnapshot {
  return {
    sampleSize: 5,
    successCount: 4,
    failureCount: 1,
    successRate: 80,
    averageDurationMs: 250,
    latestExecutedAt: "2026-04-08T10:00:00.000Z",
    unreadableCount: 1,
    recentFailures: [
      {
        startedAt: "2026-04-08T09:00:00.000Z",
        durationMs: 420,
        errorMessage: "command failed",
      },
    ],
    slowestNode: {
      nodeId: "node-ai-prompt",
      nodeLabel: "AI Prompt",
      nodeType: "aiPrompt",
      averageDurationMs: 320,
      maxDurationMs: 600,
    },
  };
}

function countAnalyticsLoadRequests(): number {
  return mocks.messageClientSend.mock.calls.filter(
    (call) => call[0] === "history:analyticsLoad",
  ).length;
}

describe("Execution Analytics Dashboard (FEAT-00019)", () => {
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

  // FEAT-00019-003005-00001
  it("emptySnapshot_showsAnalyticsEmptyState", () => {
    render(<ExecutionAnalyticsPanel snapshot={null} />);

    expect(screen.getByText("Execution Analytics")).toBeDefined();
    expect(screen.getByText("No execution analytics yet")).toBeDefined();
  });

  // FEAT-00019-003002-00001
  it("snapshot_rendersSummaryMetricsAndWarnings", () => {
    render(<ExecutionAnalyticsPanel snapshot={createSnapshot()} />);

    expect(screen.getByText("Successes")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
    expect(screen.getByText("Unreadable records: 1")).toBeDefined();
    expect(screen.getByText("Average 320ms / Max 600ms")).toBeDefined();
  });

  // FEAT-00019-003005-00007
  it("snapshot_toggleCollapse_hidesAnalyticsBody", () => {
    render(<ExecutionAnalyticsPanel snapshot={createSnapshot()} />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));

    expect(screen.queryByText("Successes")).toBeNull();
    expect(screen.queryByText("Unreadable records: 1")).toBeNull();
    expect(screen.getByRole("button", { name: "Expand" })).toBeDefined();
  });

  // FEAT-00019-003005-00002
  it("flowEditorApp_rendersAnalyticsSectionInRightPanel", () => {
    render(<FlowEditorApp />);

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          flow: { id: "flow-1", nodes: [], edges: [] },
        },
      });
    });

    expect(screen.getByText("Execution Analytics")).toBeDefined();
    expect(screen.getByText("Loading analytics...")).toBeDefined();
    expect(mocks.messageClientSend).toHaveBeenCalledWith("history:analyticsLoad", {});
  });

  // FEAT-00019-003005-00003
  it("historyAnalyticsLoaded_rendersAnalyticsSnapshot", () => {
    render(<FlowEditorApp />);

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          flow: { id: "flow-1", nodes: [], edges: [] },
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "history:analyticsLoaded",
        payload: {
          flowId: "flow-1",
          snapshot: createSnapshot(),
        },
      });
    });

    expect(screen.getByText("Unreadable records: 1")).toBeDefined();
    expect(screen.getByText("AI Prompt")).toBeDefined();
  });

  // FEAT-00019-003005-00004
  it("flowSwitch_reloadsAnalyticsAndIgnoresStaleResponse", () => {
    render(<FlowEditorApp />);

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          flow: { id: "flow-1", nodes: [], edges: [] },
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "history:analyticsLoaded",
        payload: {
          flowId: "flow-1",
          snapshot: createSnapshot(),
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          flow: { id: "flow-2", nodes: [], edges: [] },
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "history:analyticsLoaded",
        payload: {
          flowId: "flow-1",
          snapshot: createSnapshot(),
        },
      });
    });

    expect(countAnalyticsLoadRequests()).toBe(2);
    expect(screen.getByText("Loading analytics...")).toBeDefined();
    expect(screen.queryByText("AI Prompt")).toBeNull();
  });

  // FEAT-00019-003005-00005
  it("flowCompleted_requestsAnalyticsReload", () => {
    render(<FlowEditorApp />);

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          flow: { id: "flow-1", nodes: [], edges: [] },
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "history:analyticsLoaded",
        payload: {
          flowId: "flow-1",
          snapshot: createSnapshot(),
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "execution:flowCompleted",
        payload: {
          flowId: "flow-1",
          status: "success",
        },
      });
    });

    expect(countAnalyticsLoadRequests()).toBe(2);
    expect(screen.getByText("Loading analytics...")).toBeDefined();
  });

  // FEAT-00019-003005-00006
  it("debugCompleted_requestsAnalyticsReload", () => {
    render(<FlowEditorApp />);

    act(() => {
      mocks.messageHandler?.({
        type: "flow:loaded",
        payload: {
          flow: { id: "flow-1", nodes: [], edges: [] },
        },
      });
    });

    act(() => {
      mocks.messageHandler?.({
        type: "debug:paused",
        payload: {
          intermediateResults: {},
        },
      });
    });

    expect(countAnalyticsLoadRequests()).toBe(2);
    expect(screen.getByText("Loading analytics...")).toBeDefined();
  });
});