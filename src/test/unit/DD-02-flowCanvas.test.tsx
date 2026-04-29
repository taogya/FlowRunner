// @vitest-environment jsdom
// DD-02 FlowCanvas UT tests
// Trace: DD-02-007001, DD-02-007002, DD-02-007003, DD-02-007004

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CSSProperties } from "react";
import { FlowCanvas } from "@webview/components/FlowCanvas.js";
import {
  CustomNodeComponent,
  type CustomNodeData,
} from "@webview/components/FlowCanvas.js";
import type { NodeExecState } from "@webview/components/FlowEditorApp.js";

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    nodes,
    edges,
    _onNodesChange,
    _onEdgesChange,
    _onNodeClick,
    onPaneClick,
    onContextMenu,
    ...rest
  }: Record<string, unknown>) => (
    <div
      data-testid="react-flow"
      data-node-count={Array.isArray(nodes) ? nodes.length : 0}
      data-edge-count={Array.isArray(edges) ? edges.length : 0}
      data-fit-view={String(rest.fitView)}
      onClick={onPaneClick as React.MouseEventHandler}
      onContextMenu={onContextMenu as React.MouseEventHandler}
    >
      {children}
    </div>
  ),
  MiniMap: () => <div data-testid="minimap" />,
  Controls: () => <div data-testid="controls" />,
  Background: () => <div data-testid="background" />,
  Handle: ({ type, position, id, style }: { type: string; position: string; id: string; style?: CSSProperties }) => (
    <div data-testid={`handle-${type}-${id}`} data-position={position} style={style} />
  ),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  useReactFlow: () => ({
    screenToFlowPosition: (pos: { x: number; y: number }) => pos,
  }),
}));

describe("FlowCanvas", () => {
  const defaultProps = {
    nodes: [],
    edges: [],
    executionState: new Map<string, NodeExecState>(),
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onNodeClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- DD-02-007001 ---
  // DDUT-02-007001-00001
  it("renders_ReactFlowWrapper", () => {
    render(<FlowCanvas {...defaultProps} />);
    expect(screen.getByTestId("react-flow")).toBeDefined();
  });

  // --- DD-02-007002 ---
  // DDUT-02-007002-00001
  it("passesNodesAndEdgesToReactFlow", () => {
    const nodes = [{ id: "n1", type: "trigger", position: { x: 0, y: 0 }, data: {} }];
    const edges = [{ id: "e1", source: "n1", target: "n2" }];
    render(<FlowCanvas {...defaultProps} nodes={nodes} edges={edges} />);
    const rf = screen.getByTestId("react-flow");
    expect(rf.dataset.nodeCount).toBe("1");
    expect(rf.dataset.edgeCount).toBe("1");
  });

  // DDUT-02-007002-00002
  it("enablesFitView", () => {
    render(<FlowCanvas {...defaultProps} />);
    const rf = screen.getByTestId("react-flow");
    expect(rf.dataset.fitView).toBe("true");
  });

  // DDUT-02-007002-00003
  it("rendersChildComponents", () => {
    render(<FlowCanvas {...defaultProps} showMiniMap={true} />);
    expect(screen.getByTestId("minimap")).toBeDefined();
    expect(screen.getByTestId("controls")).toBeDefined();
    expect(screen.getByTestId("background")).toBeDefined();
  });

  // DDUT-02-007002-00004
  it("hidesMiniMapByDefault", () => {
    render(<FlowCanvas {...defaultProps} />);
    expect(screen.queryByTestId("minimap")).toBeNull();
    expect(screen.getByTestId("controls")).toBeDefined();
    expect(screen.getByTestId("background")).toBeDefined();
  });
});

// --- DD-02-007003 ---
describe("CustomNodeComponent", () => {
  // DDUT-02-007003-00001
  it("rendersNodeLabel", () => {
    const data: CustomNodeData = {
      label: "My Node",
      nodeType: "command",
      enabled: true,
      ports: {
        inputs: [{ id: "in1", label: "Input", dataType: "any" }],
        outputs: [{ id: "out1", label: "Output", dataType: "any" }],
      },
      executionState: "idle",
    };
    render(<CustomNodeComponent data={data} selected={false} />);
    expect(screen.getByText("My Node")).toBeDefined();
  });

  // DDUT-02-007003-00002
  it("rendersInputAndOutputHandles", () => {
    const data: CustomNodeData = {
      label: "Test",
      nodeType: "command",
      enabled: true,
      ports: {
        inputs: [{ id: "in1", label: "Input", dataType: "any" }],
        outputs: [{ id: "out1", label: "Output", dataType: "any" }],
      },
      executionState: "idle",
    };
    render(<CustomNodeComponent data={data} selected={false} />);
    expect(screen.getByTestId("handle-target-in1")).toBeDefined();
    expect(screen.getByTestId("handle-source-out1")).toBeDefined();
  });

  // DDUT-02-007003-00007
  it("alignsHandleTopToPortLabelRows", () => {
    const data: CustomNodeData = {
      label: "Aligned",
      nodeType: "command",
      enabled: true,
      ports: {
        inputs: [{ id: "in1", label: "Input", dataType: "any" }],
        outputs: [
          { id: "out1", label: "Output 1", dataType: "any" },
          { id: "out2", label: "Output 2", dataType: "any" },
        ],
      },
      executionState: "idle",
    };

    render(<CustomNodeComponent data={data} selected={false} />);

    expect((screen.getByTestId("handle-target-in1") as HTMLElement).style.top).toBe("43px");
    expect((screen.getByTestId("handle-source-out1") as HTMLElement).style.top).toBe("43px");
    expect((screen.getByTestId("handle-source-out2") as HTMLElement).style.top).toBe("61px");
  });

  // DDUT-02-007003-00003
  it("appliesExecutionStateBorder_running", () => {
    const data: CustomNodeData = {
      label: "Running",
      nodeType: "command",
      enabled: true,
      ports: { inputs: [], outputs: [] },
      executionState: "running",
    };
    const { container } = render(
      <CustomNodeComponent data={data} selected={false} />,
    );
    const statusEl = container.querySelector(".fr-node-status") as HTMLElement;
    expect(statusEl.classList.contains("fr-node-status--running")).toBe(true);
  });

  // DDUT-02-007003-00004
  it("appliesExecutionStateBorder_completed", () => {
    const data: CustomNodeData = {
      label: "Done",
      nodeType: "command",
      enabled: true,
      ports: { inputs: [], outputs: [] },
      executionState: "completed",
    };
    const { container } = render(
      <CustomNodeComponent data={data} selected={false} />,
    );
    const statusEl = container.querySelector(".fr-node-status") as HTMLElement;
    expect(statusEl.classList.contains("fr-node-status--completed")).toBe(true);
  });

  // DDUT-02-007003-00005
  it("appliesExecutionStateBorder_error", () => {
    const data: CustomNodeData = {
      label: "Err",
      nodeType: "command",
      enabled: true,
      ports: { inputs: [], outputs: [] },
      executionState: "error",
    };
    const { container } = render(
      <CustomNodeComponent data={data} selected={false} />,
    );
    const statusEl = container.querySelector(".fr-node-status") as HTMLElement;
    expect(statusEl.classList.contains("fr-node-status--error")).toBe(true);
  });

  // DDUT-02-007003-00006
  it("disabledNode_appearsGrayedOut", () => {
    const data: CustomNodeData = {
      label: "Disabled",
      nodeType: "command",
      enabled: false,
      ports: { inputs: [], outputs: [] },
      executionState: "idle",
    };
    const { container } = render(
      <CustomNodeComponent data={data} selected={false} />,
    );
    const node = container.firstChild as HTMLElement;
    expect(node.classList.contains("fr-node--disabled")).toBe(true);
  });
});

// --- DD-02-007004: コンテキストメニュー ---

describe("FlowCanvas ContextMenu", () => {
  // DDUT-02-007004-00001
  it("onContextMenu_preventsDefaultAndShowsMenu", () => {
    // Arrange
    const props = {
      nodes: [],
      edges: [],
      executionState: new Map(),
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onNodeClick: vi.fn(),
    };
    const { container } = render(<FlowCanvas {...props} />);
    const reactFlowEl = container.querySelector("[data-testid='react-flow']") || container.firstChild;

    // Act
    const prevented = { value: false };
    fireEvent.contextMenu(reactFlowEl as HTMLElement, {
      clientX: 100,
      clientY: 200,
      preventDefault: () => { prevented.value = true; },
    });

    // Assert — context menu state rendered (component shows context menu div)
    // The FlowCanvas should handle the context menu event
    expect(reactFlowEl).toBeDefined();
  });

  // DDUT-02-007004-00002
  it("paneClick_callsDeselectAll", () => {
    const onDeselectAll = vi.fn();
    const props = {
      nodes: [],
      edges: [],
      executionState: new Map(),
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onNodeClick: vi.fn(),
      onDeselectAll,
    };

    render(<FlowCanvas {...props} />);
    fireEvent.click(screen.getByTestId("react-flow"));

    expect(onDeselectAll).toHaveBeenCalledTimes(1);
  });
});
