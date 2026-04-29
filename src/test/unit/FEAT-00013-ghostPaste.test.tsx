// @vitest-environment jsdom
// FEAT-00013 Ghost Paste UT tests
// Trace: FEAT-00013-002001, FEAT-00013-002002

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { FlowEditorApp } from "@webview/components/FlowEditorApp.js";
import type { FlowNode, FlowEdge } from "@webview/components/FlowEditorApp.js";
import { placeNodesAroundCenter } from "@webview/services/clipboardHelpers.js";

interface MockMessage {
  type: string;
  payload: Record<string, unknown>;
}

// Mock MessageClient
vi.mock("@webview/services/MessageClient.js", () => ({
  messageClient: {
    send: vi.fn(),
    onMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
}));

// Mock @xyflow/react — children rendered to surface ghost overlay
vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="react-flow-provider">{children}</div>
  ),
  ReactFlow: ({
    children,
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="react-flow">
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

// ================================================
// §2.2 Placement Logic (FEAT-00013-002002)
// ================================================
describe("Ghost Paste Placement Logic", () => {
  // FEAT-00013-002002-00001
  it("confirm_placesNodesAtClickPositionWithBoundingCenterOffset", () => {
    // Arrange — 2 ghost nodes with visual center at (130, 55)
    const ghostNodes: FlowNode[] = [
      { id: "g1", type: "command", position: { x: 0, y: 0 }, data: { label: "A" } },
      { id: "g2", type: "command", position: { x: 100, y: 50 }, data: { label: "B" } },
    ];
    const clickPosition = { x: 200, y: 100 };

    // Act
    const result = placeNodesAroundCenter(ghostNodes, clickPosition);

    // Assert — visual center was (130,55), click at (200,100) → offset (70,45)
    expect(result[0].position).toEqual({ x: 70, y: 45 });
    expect(result[1].position).toEqual({ x: 170, y: 95 });
    expect(result[0].selected).toBe(true);
    expect(result[1].selected).toBe(true);
  });

  // FEAT-00013-002002-00003
  it("confirm_singleNode_placesNodeCenterOnClickPosition", () => {
    // Arrange
    const ghostNodes: FlowNode[] = [
      { id: "g1", type: "command", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];

    // Act
    const result = placeNodesAroundCenter(ghostNodes, { x: 200, y: 100 });

    // Assert
    expect(result[0].position).toEqual({ x: 120, y: 70 });
  });
});

// ================================================
// §2.1 Ghost Mode Transition (FEAT-00013-002001)
// §2.2 Cancel (FEAT-00013-002002)
// ================================================
describe("Ghost Paste Component Integration", () => {
  let messageHandler: (msg: MockMessage) => void;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { messageClient } = vi.mocked(
      await import("@webview/services/MessageClient.js"),
    );
    let clipboardStore: { nodes: FlowNode[]; edges: FlowEdge[] } | null = null;
    messageHandler = () => {};
    (messageClient.onMessage as ReturnType<typeof vi.fn>).mockImplementation(
      (handler: (msg: MockMessage) => void) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      },
    );
    (messageClient.send as ReturnType<typeof vi.fn>).mockImplementation(
      (type: string, payload: Record<string, unknown>) => {
        if (type === "clipboard:set") {
          clipboardStore = {
            nodes: structuredClone((payload.nodes as FlowNode[] | undefined) ?? []),
            edges: structuredClone((payload.edges as FlowEdge[] | undefined) ?? []),
          };
          return;
        }

        if (type === "clipboard:get") {
          queueMicrotask(() => {
            messageHandler({
              type: "clipboard:loaded",
              payload: clipboardStore ?? { nodes: [], edges: [] },
            });
          });
        }
      },
    );
  });

  function loadFlowWithSelectedNodes() {
    render(<FlowEditorApp />);
    // Load flow with nodes (selected=true)
    act(() => {
      messageHandler({
        type: "flow:loaded",
        payload: {
          flow: {
            nodes: [
              { id: "n1", type: "command", position: { x: 0, y: 0 }, data: { label: "A" }, selected: true },
              { id: "n2", type: "command", position: { x: 100, y: 0 }, data: { label: "B" }, selected: true },
            ],
            edges: [],
          },
        },
      });
    });
    // Select All → Copy → Paste sequence to enter ghost mode
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", metaKey: true, bubbles: true }));
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true, bubbles: true }));
    });
  }

  // FEAT-00013-002001-00001
  // FEAT-00021-003002-00002
  it("cmdV_setsGhostState_overlayAppears", async () => {
    // Arrange
    loadFlowWithSelectedNodes();

    // Act — Paste (Cmd+V)
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "v", metaKey: true, bubbles: true }));
    });

    // Assert — ghost overlay should appear with node-style ghost (type badge + label)
    expect(screen.getByText("+1")).toBeDefined();
  });

  // FEAT-00013-002002-00002
  it("escape_exitsGhostMode_overlayDisappears", async () => {
    // Arrange
    loadFlowWithSelectedNodes();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "v", metaKey: true, bubbles: true }));
    });
    // Verify overlay is present
    expect(screen.getByText("+1")).toBeDefined();

    // Act — Escape
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    // Assert — overlay should disappear
    expect(screen.queryByText("+1")).toBeNull();
  });
});
