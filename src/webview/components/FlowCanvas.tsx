// Trace: DD-02-007001, DD-02-007002, DD-02-007003, DD-02-007004
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { ReactFlow, MiniMap, Controls, Background, Handle, Position, useReactFlow } from "@xyflow/react";
import type { Connection } from "@xyflow/react";
import type { PortDefinition } from "@shared/types/node.js";
import type { NodeExecState } from "./FlowEditorApp.js";

// Trace: DD-02-007004
export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetType: "node" | "edge" | "canvas";
  targetId: string | null;
}

// Trace: DD-02-007003
export interface CustomNodeData {
  label: string;
  nodeType: string;
  enabled: boolean;
  ports: {
    inputs: PortDefinition[];
    outputs: PortDefinition[];
  };
  executionState: NodeExecState;
}

interface CustomNodeProps {
  data: CustomNodeData;
  selected: boolean;
}

interface ClipboardNode {
  type: string;
  data: Record<string, unknown>;
}

const nodeTypeAbbrevs: Record<string, string> = {
  trigger: "T",
  command: "C",
  condition: "?",
  loop: "L",
  subFlow: "S",
  log: "O",
  file: "F",
  comment: "#",
  http: "H",
  aiPrompt: "AI",
  transform: "X",
};

// Trace: DD-02-007003
export const CustomNodeComponent: React.FC<CustomNodeProps> = ({
  data,
  selected,
}) => {
  const ports = data.ports ?? { inputs: [], outputs: [] };
  const enabled = data.enabled ?? true;
  const execState = data.executionState ?? "idle";
  const nodeType = data.nodeType ?? "command";
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const showTooltip = useCallback((e: React.MouseEvent, port: PortDefinition, isOutput: boolean) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const lines = [`${port.label} (${port.id})`, `型: ${port.dataType}`];
    if (isOutput) lines.push("接続先で {{input}} として参照");
    setTooltip({ text: lines.join("\n"), x: rect.right + 8, y: rect.top });
  }, []);
  const hideTooltip = useCallback(() => setTooltip(null), []);

  const classNames = [
    "fr-node",
    `fr-node--${nodeType}`,
    selected ? "fr-node--selected" : "",
    !enabled ? "fr-node--disabled" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={classNames}>
      {ports.inputs.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={ports.inputs.length > 1 ? { top: `${((i + 1) / (ports.inputs.length + 1)) * 100}%` } : undefined}
        />
      ))}
      <div className="fr-node-header">
        <span className="fr-node-type-badge">
          {nodeTypeAbbrevs[nodeType] ?? nodeType[0]?.toUpperCase()}
        </span>
        <span className="fr-node-label">{data.label}</span>
        <span className={`fr-node-status fr-node-status--${execState}`} />
      </div>
      {(ports.inputs.length > 0 || ports.outputs.length > 0) && (
        <div className="fr-node-ports">
          <div className="fr-node-port-group">
            {ports.inputs.map((port) => (
              <span
                key={port.id}
                className="fr-node-port-label"
                onMouseEnter={(e) => showTooltip(e, port, false)}
                onMouseLeave={hideTooltip}
              >{port.label}</span>
            ))}
          </div>
          <div className="fr-node-port-group" style={{ textAlign: "right" }}>
            {ports.outputs.map((port) => (
              <span
                key={port.id}
                className="fr-node-port-label"
                onMouseEnter={(e) => showTooltip(e, port, true)}
                onMouseLeave={hideTooltip}
              >{port.label}</span>
            ))}
          </div>
        </div>
      )}
      {ports.outputs.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={ports.outputs.length > 1 ? { top: `${((i + 1) / (ports.outputs.length + 1)) * 100}%` } : undefined}
        />
      ))}
      {tooltip && createPortal(
        <div
          className="fr-tooltip"
          style={{ position: "fixed", left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text.split("\n").map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

// Trace: DD-02-007002
const nodeTypes = {
  trigger: CustomNodeComponent,
  command: CustomNodeComponent,
  condition: CustomNodeComponent,
  loop: CustomNodeComponent,
  subFlow: CustomNodeComponent,
  log: CustomNodeComponent,
  file: CustomNodeComponent,
  comment: CustomNodeComponent,
  http: CustomNodeComponent,
  aiPrompt: CustomNodeComponent,
  transform: CustomNodeComponent,
};

// Trace: DD-02-007001
interface FlowCanvasProps {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  executionState: Map<string, NodeExecState>;
  onNodesChange: (changes: unknown[]) => void;
  onEdgesChange: (changes: unknown[]) => void;
  onNodeClick: (nodeId: string) => void;
  onConnect?: (connection: Connection) => void;
  onNodeDrop?: (nodeType: string, position: { x: number; y: number }) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onCopyNode?: (nodeId: string) => void;
  onCutNode?: (nodeId: string) => void;
  onPasteNode?: (clipboard: ClipboardNode, position: { x: number; y: number }) => void;
  onSelectAll?: () => void;
  onOpenSettings?: (nodeId: string) => void;
  showMiniMap?: boolean;
}

// Trace: DD-02-007004
const initialContextMenu: ContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  targetType: "canvas",
  targetId: null,
};

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  edges,
  executionState,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onConnect,
  onNodeDrop,
  onDeleteNode,
  onDeleteEdge,
  onCopyNode,
  onCutNode,
  onPasteNode,
  onSelectAll,
  onOpenSettings,
  showMiniMap = false,
}) => {
  // Track highlighted edge ID via direct edge click for immediate update
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);

  // Reset highlighted edge when execution starts
  useEffect(() => {
    const hasRunning = Array.from(executionState.values()).some((s) => s === "running");
    if (hasRunning) {
      setHighlightedEdgeId(null);
    }
  }, [executionState]);

  const handleEdgeClick = useCallback((_event: unknown, edge: { id: string }) => {
    setHighlightedEdgeId(edge.id);
  }, []);

  // Apply execution-state-based edge styles + selection highlight (inline style for CSS priority)
  const styledEdges = useMemo(() => {
    const hasExecution = Array.from(executionState.values()).some(
      (s) => s === "running" || s === "completed" || s === "error",
    );

    return (edges as Array<{ id: string; source: string; target: string; [k: string]: unknown }>).map((edge) => {
      const sourceState = executionState.get(edge.source) ?? "idle";
      const targetState = executionState.get(edge.target) ?? "idle";
      const isRunning = sourceState === "running" || targetState === "running";
      const isCompleted = sourceState === "completed" && targetState === "completed";
      const isError = sourceState === "error" || targetState === "error";
      const isHighlighted = highlightedEdgeId === edge.id;

      if (isRunning) {
        return { ...edge, animated: true, style: { stroke: "var(--vscode-charts-yellow, #cca700)", strokeWidth: 3 } };
      }
      if (isError) {
        return { ...edge, animated: false, style: { stroke: "var(--vscode-errorForeground, #f85149)", strokeWidth: 2.5 } };
      }
      if (isCompleted) {
        return { ...edge, animated: false, style: { stroke: "var(--vscode-charts-green, #388a34)", strokeWidth: 2.5 } };
      }
      if (isHighlighted) {
        return { ...edge, animated: false, style: { stroke: "var(--fr-focus-border, #007fd4)", strokeWidth: 2.5 } };
      }
      // During execution, explicitly disable animation on idle edges
      if (hasExecution) {
        return { ...edge, animated: false };
      }
      return edge;
    });
  }, [edges, executionState, highlightedEdgeId]);
  // Trace: DD-02-007004
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(initialContextMenu);
  const clipboardRef = useRef<ClipboardNode | null>(null);
  const reactFlowInstance = useReactFlow();
  const { screenToFlowPosition } = reactFlowInstance;

  // Ghost placement mode
  const [ghostClipboard, setGhostClipboard] = useState<ClipboardNode | null>(null);
  const ghostElRef = useRef<HTMLDivElement>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(initialContextMenu);
  }, []);

  // Trace: DD-02-007004
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      const target = (event.target as HTMLElement).closest("[data-id]");
      let targetType: ContextMenuState["targetType"] = "canvas";
      let targetId: string | null = null;

      if (target) {
        const id = target.getAttribute("data-id");
        const isEdge = target.classList.contains("react-flow__edge");
        targetType = isEdge ? "edge" : "node";
        targetId = id;
      }

      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        targetType,
        targetId,
      });
    },
    [],
  );

  const handleCopy = useCallback(() => {
    if (contextMenu.targetType === "node" && contextMenu.targetId) {
      const node = nodes.find((n) => (n as { id: string }).id === contextMenu.targetId) as
        | { type: string; data: Record<string, unknown> }
        | undefined;
      if (node) {
        clipboardRef.current = { type: node.type, data: { ...node.data } };
        // Enter ghost placement mode immediately on Copy
        setGhostClipboard({ type: node.type, data: { ...node.data } });
      }
      onCopyNode?.(contextMenu.targetId);
    }
    closeContextMenu();
  }, [contextMenu, nodes, onCopyNode, closeContextMenu]);

  const handleCut = useCallback(() => {
    if (contextMenu.targetType === "node" && contextMenu.targetId) {
      const node = nodes.find((n) => (n as { id: string }).id === contextMenu.targetId) as
        | { type: string; data: Record<string, unknown> }
        | undefined;
      if (node) {
        clipboardRef.current = { type: node.type, data: { ...node.data } };
      }
      onCutNode?.(contextMenu.targetId);
    }
    closeContextMenu();
  }, [contextMenu, nodes, onCutNode, closeContextMenu]);

  const handlePaste = useCallback(() => {
    if (clipboardRef.current) {
      setGhostClipboard({ ...clipboardRef.current });
    }
    closeContextMenu();
  }, [closeContextMenu]);

  const handleDelete = useCallback(() => {
    if (contextMenu.targetId) {
      if (contextMenu.targetType === "node") {
        onDeleteNode?.(contextMenu.targetId);
      } else if (contextMenu.targetType === "edge") {
        onDeleteEdge?.(contextMenu.targetId);
      }
    }
    closeContextMenu();
  }, [contextMenu, onDeleteNode, onDeleteEdge, closeContextMenu]);

  const handleOpenSettings = useCallback(() => {
    if (contextMenu.targetType === "node" && contextMenu.targetId) {
      onOpenSettings?.(contextMenu.targetId);
    }
    closeContextMenu();
  }, [contextMenu, onOpenSettings, closeContextMenu]);

  const handleSelectAll = useCallback(() => {
    onSelectAll?.();
    closeContextMenu();
  }, [onSelectAll, closeContextMenu]);

  const handleZoomReset = useCallback(() => {
    reactFlowInstance.fitView();
    closeContextMenu();
  }, [reactFlowInstance, closeContextMenu]);

  // Ghost placement mode: event listeners
  useEffect(() => {
    if (!ghostClipboard) return;

    document.body.style.cursor = "crosshair";

    const handleMouseMove = (e: MouseEvent) => {
      if (ghostElRef.current) {
        ghostElRef.current.style.left = `${e.clientX}px`;
        ghostElRef.current.style.top = `${e.clientY}px`;
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (e.button === 0) {
        e.stopPropagation();
        e.preventDefault();
        // Offset so the node center aligns with cursor (approx node size: 160x60)
        const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        onPasteNode?.(ghostClipboard, { x: flowPos.x - 80, y: flowPos.y - 30 });
        setGhostClipboard(null);
      }
    };

    const handleContextMenuCancel = (e: MouseEvent) => {
      e.preventDefault();
      setGhostClipboard(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGhostClipboard(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("contextmenu", handleContextMenuCancel, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("contextmenu", handleContextMenuCancel, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [ghostClipboard, screenToFlowPosition, onPasteNode]);

  // Trace: DD-02-006002 — ドラッグ&ドロップ
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData("application/flowrunner-node-type");
    if (!nodeType || !onNodeDrop) return;
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    onNodeDrop(nodeType, position);
  }, [onNodeDrop, screenToFlowPosition]);

  return (
    <div
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ width: "100%", height: "100%" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep" }}
        minZoom={0.1}
        maxZoom={2.0}
        fitView={true}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_event: unknown, node: { id: string }) => {
          setHighlightedEdgeId(null);
          onNodeClick(node.id);
        }}
        onEdgeClick={handleEdgeClick}
        onPaneClick={() => {
          setHighlightedEdgeId(null);
          closeContextMenu();
        }}
      >
        {showMiniMap && <MiniMap />}
        <Controls />
        <Background />
      </ReactFlow>
      {contextMenu.visible && (
        <div
          className="fr-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.targetType === "node" && (
            <>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleCopy}>
                Copy
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleCut}>
                Cut
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleDelete}>
                Delete
              </div>
              <div className="fr-context-menu-separator" />
              <div role="menuitem" className="fr-context-menu-item" onClick={handleOpenSettings}>
                Open Settings
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleSelectAll}>
                Select All
              </div>
            </>
          )}
          {contextMenu.targetType === "edge" && (
            <>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleDelete}>
                Delete
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleSelectAll}>
                Select All
              </div>
            </>
          )}
          {contextMenu.targetType === "canvas" && (
            <>
              <div
                role="menuitem"
                className={`fr-context-menu-item ${clipboardRef.current ? "" : "fr-context-menu-item--disabled"}`}
                onClick={clipboardRef.current ? handlePaste : undefined}
              >
                Paste
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleSelectAll}>
                Select All
              </div>
              <div className="fr-context-menu-separator" />
              <div role="menuitem" className="fr-context-menu-item" onClick={handleZoomReset}>
                Zoom Reset
              </div>
            </>
          )}
        </div>
      )}
      {ghostClipboard && (
        <div
          ref={ghostElRef}
          className="fr-ghost-node"
        >
          <div className={`fr-node fr-node--${ghostClipboard.type}`}>
            <div className="fr-node-header">
              <span className="fr-node-type-badge">
                {nodeTypeAbbrevs[ghostClipboard.type] ?? ghostClipboard.type[0]?.toUpperCase()}
              </span>
              <span className="fr-node-label">
                {(ghostClipboard.data.label as string) ?? ghostClipboard.type}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
