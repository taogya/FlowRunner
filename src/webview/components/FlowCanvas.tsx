// Trace: DD-02-007001, DD-02-007002, DD-02-007003, DD-02-007004
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { ReactFlow, MiniMap, Controls, Background, Handle, Position, useReactFlow } from "@xyflow/react";
import type { Connection } from "@xyflow/react";
import * as l10n from "@vscode/l10n";
import type { PortDefinition } from "@shared/types/node.js";
import type { NodeExecState, FlowNode } from "./FlowEditorApp.js";
import { getTopLeftFromCenter } from "../services/clipboardHelpers.js";

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
  debugPaused?: boolean;
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
  tryCatch: "TC",
  parallel: "P",
};

const NODE_HEADER_HEIGHT = 31;
const PORTS_VERTICAL_PADDING = 4;
const PORT_ROW_HEIGHT = 16;
const PORT_ROW_GAP = 2;

function getPortHandleStyle(index: number): React.CSSProperties {
  return {
    top: `${NODE_HEADER_HEIGHT + PORTS_VERTICAL_PADDING + (PORT_ROW_HEIGHT / 2) + index * (PORT_ROW_HEIGHT + PORT_ROW_GAP)}px`,
  };
}

// Trace: DD-02-007003
export const CustomNodeComponent: React.FC<CustomNodeProps> = ({
  data,
  selected,
}) => {
  const ports = data.ports ?? { inputs: [], outputs: [] };
  const enabled = data.enabled ?? true;
  const debugPaused = data.debugPaused ?? false;
  const execState = data.executionState ?? "idle";
  const nodeType = data.nodeType ?? "command";
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const showTooltip = useCallback((e: React.MouseEvent, port: PortDefinition, isOutput: boolean) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const lines = [`${port.label} (${port.id})`, l10n.t("Type: {0}", port.dataType)];
    // Trace: REV-016 #7 — neutral tooltip without syntax-specific hint
    if (isOutput) lines.push(l10n.t("Outputs to target node's input data"));
    setTooltip({ text: lines.join("\n"), x: rect.right + 8, y: rect.top });
  }, []);
  const hideTooltip = useCallback(() => setTooltip(null), []);

  const classNames = [
    "fr-node",
    `fr-node--${nodeType}`,
    debugPaused ? "fr-node--debug-paused" : "",
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
          style={getPortHandleStyle(i)}
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
          <div className="fr-node-port-group fr-node-port-group--outputs">
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
          style={getPortHandleStyle(i)}
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
  tryCatch: CustomNodeComponent,
  parallel: CustomNodeComponent,
};

// Trace: DD-02-007001
interface FlowCanvasProps {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  executionState: Map<string, NodeExecState>;
  focusedNodeId?: string | null;
  onFocusedNodeHandled?: () => void;
  onNodesChange: (changes: unknown[]) => void;
  onEdgesChange: (changes: unknown[]) => void;
  onNodeClick: (nodeId: string) => void;
  onConnect?: (connection: Connection) => void;
  onNodeDrop?: (nodeType: string, position: { x: number; y: number }) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onDeleteSelected?: () => void;
  onCopyNode?: (nodeId: string) => void;
  onClipboardSelectionChange?: (clipboard: { nodes: FlowNode[]; edges: [] }) => void;
  onCutNode?: (nodeId: string) => void;
  clipboardNode?: ClipboardNode | null;
  onPasteNode?: (clipboard: ClipboardNode, position: { x: number; y: number }) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onOpenSettings?: (nodeId: string) => void;
  onAutoLayout?: () => void;
  showMiniMap?: boolean;
  ghostPasteNodeCount?: number;
  ghostPasteFirstType?: string;
  ghostPasteFirstLabel?: string;
  onGhostPasteConfirm?: (flowPosition: { x: number; y: number }) => void;
  onGhostPasteCancel?: () => void;
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
  focusedNodeId,
  onFocusedNodeHandled,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onConnect,
  onNodeDrop,
  onDeleteNode,
  onDeleteEdge,
  onDeleteSelected,
  onCopyNode,
  onClipboardSelectionChange,
  onCutNode,
  clipboardNode,
  onPasteNode,
  onSelectAll,
  onDeselectAll,
  onOpenSettings,
  onAutoLayout,
  showMiniMap = false,
  ghostPasteNodeCount = 0,
  ghostPasteFirstType,
  ghostPasteFirstLabel,
  onGhostPasteConfirm,
  onGhostPasteCancel,
}) => {
  // Track highlighted edge ID via direct edge click for immediate update
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);

  // Ghost paste overlay: track mouse position for placement indicator
  const [ghostMousePos, setGhostMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isGhostPasteMode = ghostPasteNodeCount > 0;

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
  const reactFlowInstance = useReactFlow();
  const { screenToFlowPosition } = reactFlowInstance;

  useEffect(() => {
    if (!focusedNodeId) {
      return;
    }

    const targetNode = nodes.find((node) => String(node.id) === focusedNodeId);
    if (!targetNode) {
      onFocusedNodeHandled?.();
      return;
    }

    const position = targetNode.position as { x: number; y: number } | undefined;
    if (!position) {
      onFocusedNodeHandled?.();
      return;
    }

    void reactFlowInstance.setCenter(position.x + 80, position.y + 30, {
      duration: 180,
      zoom: reactFlowInstance.getZoom(),
    });
    onFocusedNodeHandled?.();
  }, [focusedNodeId, nodes, onFocusedNodeHandled, reactFlowInstance]);

  // Ghost placement mode
  const [ghostClipboard, setGhostClipboard] = useState<ClipboardNode | null>(null);
  const ghostElRef = useRef<HTMLDivElement>(null);

  // Ghost paste overlay handlers
  const handleGhostMouseMove = useCallback((e: React.MouseEvent) => {
    setGhostMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleGhostClick = useCallback((e: React.MouseEvent) => {
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    onGhostPasteConfirm?.(flowPos);
  }, [screenToFlowPosition, onGhostPasteConfirm]);

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
        | { id: string; type: string; data: Record<string, unknown>; position?: { x: number; y: number } }
        | undefined;
      if (node) {
        // Trace: FEAT-00021 — コンテキストメニュー操作もフロー間共有クリップボードへ送る
        onClipboardSelectionChange?.({
          nodes: [
            {
              id: node.id,
              type: node.type,
              position: structuredClone(node.position ?? { x: 0, y: 0 }) as { x: number; y: number },
              data: structuredClone(node.data),
            },
          ],
          edges: [],
        });
        // Enter ghost placement mode immediately on Copy
        setGhostClipboard({ type: node.type, data: structuredClone(node.data) });
      }
      onCopyNode?.(contextMenu.targetId);
    }
    closeContextMenu();
  }, [contextMenu, nodes, onClipboardSelectionChange, onCopyNode, closeContextMenu]);

  const handleCut = useCallback(() => {
    if (contextMenu.targetType === "node" && contextMenu.targetId) {
      const node = nodes.find((n) => (n as { id: string }).id === contextMenu.targetId) as
        | { id: string; type: string; data: Record<string, unknown>; position?: { x: number; y: number } }
        | undefined;
      if (node) {
        onClipboardSelectionChange?.({
          nodes: [
            {
              id: node.id,
              type: node.type,
              position: structuredClone(node.position ?? { x: 0, y: 0 }) as { x: number; y: number },
              data: structuredClone(node.data),
            },
          ],
          edges: [],
        });
      }
      onCutNode?.(contextMenu.targetId);
    }
    closeContextMenu();
  }, [contextMenu, nodes, onClipboardSelectionChange, onCutNode, closeContextMenu]);

  const handlePaste = useCallback(() => {
    if (clipboardNode) {
      setGhostClipboard(structuredClone(clipboardNode));
    }
    closeContextMenu();
  }, [clipboardNode, closeContextMenu]);

  const handleDelete = useCallback(() => {
    if (contextMenu.targetId) {
      if (contextMenu.targetType === "node") {
        // 選択ノードが複数ある場合は全選択ノードを削除
        const selectedNodes = nodes.filter(n => (n as unknown as FlowNode & { selected?: boolean }).selected);
        if (selectedNodes.length > 1 && selectedNodes.some(n => n.id === contextMenu.targetId)) {
          onDeleteSelected?.();
        } else {
          onDeleteNode?.(contextMenu.targetId);
        }
      } else if (contextMenu.targetType === "edge") {
        onDeleteEdge?.(contextMenu.targetId);
      }
    }
    closeContextMenu();
  }, [contextMenu, nodes, onDeleteNode, onDeleteEdge, onDeleteSelected, closeContextMenu]);

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

  const handleAutoLayout = useCallback(() => {
    onAutoLayout?.();
    closeContextMenu();
  }, [onAutoLayout, closeContextMenu]);

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
        const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        onPasteNode?.(ghostClipboard, getTopLeftFromCenter(flowPos));
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
        defaultEdgeOptions={{ type: "bezier" }}
        minZoom={0.1}
        maxZoom={2.0}
        fitView={true}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        selectionOnDrag={false}
        panOnDrag={true}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
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
          onDeselectAll?.();
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
                {l10n.t("Copy")}
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleCut}>
                {l10n.t("Cut")}
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleDelete}>
                {l10n.t("Delete")}
              </div>
              <div className="fr-context-menu-separator" />
              <div role="menuitem" className="fr-context-menu-item" onClick={handleOpenSettings}>
                {l10n.t("Open Settings")}
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleSelectAll}>
                {l10n.t("Select All")}
              </div>
              <div className="fr-context-menu-separator" />
              <div role="menuitem" className="fr-context-menu-item" onClick={handleAutoLayout}>
                {l10n.t("Auto Layout")}
              </div>
            </>
          )}
          {contextMenu.targetType === "edge" && (
            <>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleDelete}>
                {l10n.t("Delete")}
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleSelectAll}>
                {l10n.t("Select All")}
              </div>
              <div className="fr-context-menu-separator" />
              <div role="menuitem" className="fr-context-menu-item" onClick={handleAutoLayout}>
                {l10n.t("Auto Layout")}
              </div>
            </>
          )}
          {contextMenu.targetType === "canvas" && (
            <>
              <div
                role="menuitem"
                className={`fr-context-menu-item ${clipboardNode ? "" : "fr-context-menu-item--disabled"}`}
                onClick={clipboardNode ? handlePaste : undefined}
              >
                {l10n.t("Paste")}
              </div>
              <div role="menuitem" className="fr-context-menu-item" onClick={handleSelectAll}>
                {l10n.t("Select All")}
              </div>
              <div className="fr-context-menu-separator" />
              <div role="menuitem" className="fr-context-menu-item" onClick={handleZoomReset}>
                {l10n.t("Zoom Reset")}
              </div>
              <div className="fr-context-menu-separator" />
              <div role="menuitem" className="fr-context-menu-item" onClick={handleAutoLayout}>
                {l10n.t("Auto Layout")}
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
      {isGhostPasteMode && (
        <div
          className="fr-ghost-paste-overlay"
          onMouseMove={handleGhostMouseMove}
          onClick={handleGhostClick}
        >
          <div
            className="fr-ghost-node"
            style={{
              left: ghostMousePos.x,
              top: ghostMousePos.y,
            }}
          >
            <div className={`fr-node fr-node--${ghostPasteFirstType ?? "command"}`}>
              <div className="fr-node-header">
                <span className="fr-node-type-badge">
                  {nodeTypeAbbrevs[ghostPasteFirstType ?? "command"] ?? "?"}
                </span>
                <span className="fr-node-label">
                  {ghostPasteFirstLabel ?? ghostPasteFirstType ?? "Node"}
                </span>
              </div>
            </div>
            {ghostPasteNodeCount > 1 && (
              <span className="fr-ghost-paste-count">+{ghostPasteNodeCount - 1}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
