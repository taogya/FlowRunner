// Trace: DD-02-004001, DD-02-004002, DD-02-004003
import React, { useEffect, useReducer, useState, useCallback, useMemo } from "react";
import { ReactFlowProvider, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { NodeChange, EdgeChange, Connection } from "@xyflow/react";
import { messageClient } from "../services/MessageClient.js";
import { FlowCanvas } from "./FlowCanvas.js";
import { Toolbar } from "./Toolbar.js";
import { PropertyPanel } from "./PropertyPanel.js";
import { NodePalette } from "./NodePalette.js";
import { useUndoRedo } from "../hooks/useUndoRedo.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { NodeResult } from "@shared/types/execution.js";
import type { NodeSettings } from "@shared/types/flow.js";

// Trace: DD-02-004002 — NodeExecState 列挙
export type NodeExecState = "idle" | "running" | "completed" | "error";

// Trace: DD-02-004002 — FlowEditorState
export interface FlowEditorState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId: string | null;
  executionState: Map<string, NodeExecState>;
  isDebugMode: boolean;
  isDirty: boolean;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// Trace: DD-02-004002 — FlowEditorAction
export type FlowEditorAction =
  | { type: "FLOW_LOADED"; nodes: FlowNode[]; edges: FlowEdge[] }
  | { type: "NODES_CHANGED"; nodes: FlowNode[] }
  | { type: "EDGES_CHANGED"; edges: FlowEdge[] }
  | { type: "NODE_SELECTED"; nodeId: string | null }
  | { type: "NODE_EXEC_STATE"; nodeId: string; state: NodeExecState }
  | { type: "DEBUG_MODE"; active: boolean }
  | { type: "FLOW_SAVED" };

export const initialState: FlowEditorState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  executionState: new Map(),
  isDebugMode: false,
  isDirty: false,
};

// Trace: DD-02-004002 — Reducer
export function flowEditorReducer(
  state: FlowEditorState,
  action: FlowEditorAction,
): FlowEditorState {
  switch (action.type) {
    case "FLOW_LOADED":
      return {
        ...state,
        nodes: action.nodes,
        edges: action.edges,
        executionState: new Map(),
        isDirty: false,
      };
    case "NODES_CHANGED":
      return { ...state, nodes: action.nodes, isDirty: true };
    case "EDGES_CHANGED":
      return { ...state, edges: action.edges, isDirty: true };
    case "NODE_SELECTED":
      return { ...state, selectedNodeId: action.nodeId };
    case "NODE_EXEC_STATE": {
      const newMap = new Map(state.executionState);
      newMap.set(action.nodeId, action.state);
      return { ...state, executionState: newMap };
    }
    case "DEBUG_MODE":
      return { ...state, isDebugMode: action.active };
    case "FLOW_SAVED":
      return { ...state, isDirty: false };
    default:
      return state;
  }
}

export const FlowEditorApp: React.FC = () => {
  const [state, dispatch] = useReducer(flowEditorReducer, initialState);
  const [nodeTypesList, setNodeTypesList] = useState<INodeTypeMetadata[]>([]);
  const [executionResults, setExecutionResults] = useState<Map<string, NodeResult>>(new Map());
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const { pushState, undo, redo } = useUndoRedo();

  // Trace: DD-02-004002 — 派生ステート
  const isRunning = useMemo(
    () => Array.from(state.executionState.values()).some(s => s === "running"),
    [state.executionState],
  );

  const selectedNode = useMemo(() => {
    if (!state.selectedNodeId) return null;
    return state.nodes.find(n => n.id === state.selectedNodeId) ?? null;
  }, [state.nodes, state.selectedNodeId]);

  const selectedNodeForPanel = useMemo(() => {
    if (!selectedNode) return null;
    return {
      id: selectedNode.id,
      type: selectedNode.type,
      label: (selectedNode.data.label as string) ?? selectedNode.type,
      enabled: (selectedNode.data.enabled as boolean) ?? true,
      position: selectedNode.position,
      settings: (selectedNode.data.settings as NodeSettings) ?? {},
    };
  }, [selectedNode]);

  const selectedNodeMetadata = useMemo(() => {
    if (!selectedNode) return null;
    return nodeTypesList.find(m => m.nodeType === selectedNode.type) ?? null;
  }, [selectedNode, nodeTypesList]);

  const selectedNodeOutput = useMemo(() => {
    if (!state.selectedNodeId) return null;
    return executionResults.get(state.selectedNodeId) ?? null;
  }, [state.selectedNodeId, executionResults]);

  const nodePaletteItems = useMemo(() => {
    return nodeTypesList.map(m => ({
      type: m.nodeType,
      label: m.label,
      category: m.category,
    }));
  }, [nodeTypesList]);

  // Trace: DD-02-004003 — mount 時に flow:load / node:getTypes メッセージ送信
  useEffect(() => {
    messageClient.send("flow:load", {});
    messageClient.send("node:getTypes", {});
  }, []);

  // Trace: DD-02-004003 — メッセージハンドリング
  useEffect(() => {
    const subscription = messageClient.onMessage(
      (msg: { type: string; payload: Record<string, unknown> }) => {
        switch (msg.type) {
          case "flow:loaded": {
            // Trace: DD-02-004003 — NodeInstance/EdgeInstance → FlowNode/FlowEdge 変換
            const flow = msg.payload.flow as Record<string, unknown> | undefined;
            const rawNodes = ((flow?.nodes ?? msg.payload.nodes) ?? []) as any[];
            const rawEdges = ((flow?.edges ?? msg.payload.edges) ?? []) as any[];
            const nodes: FlowNode[] = rawNodes.map((n: any) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data ?? { label: n.label, enabled: n.enabled, settings: n.settings },
            }));
            const edges: FlowEdge[] = rawEdges.map((e: any) => ({
              id: e.id,
              source: e.source ?? e.sourceNodeId,
              target: e.target ?? e.targetNodeId,
              sourceHandle: e.sourceHandle ?? e.sourcePortId,
              targetHandle: e.targetHandle ?? e.targetPortId,
            }));
            dispatch({ type: "FLOW_LOADED", nodes, edges });
            break;
          }
          case "execution:nodeStarted":
            dispatch({
              type: "NODE_EXEC_STATE",
              nodeId: msg.payload.nodeId as string,
              state: "running",
            });
            break;
          case "execution:nodeCompleted":
            dispatch({
              type: "NODE_EXEC_STATE",
              nodeId: msg.payload.nodeId as string,
              state: "completed",
            });
            if (msg.payload.result) {
              setExecutionResults(prev => {
                const next = new Map(prev);
                next.set(msg.payload.nodeId as string, msg.payload.result as NodeResult);
                return next;
              });
            }
            break;
          case "execution:nodeError":
            dispatch({
              type: "NODE_EXEC_STATE",
              nodeId: msg.payload.nodeId as string,
              state: "error",
            });
            break;
          case "execution:flowCompleted":
            break;
          case "debug:paused": {
            // Trace: DD-02-004002 — update node execution states from intermediateResults
            const results = msg.payload.intermediateResults as Record<string, { status: string }> | undefined;
            if (results) {
              for (const [nid, result] of Object.entries(results)) {
                const execState: NodeExecState = result.status === "success" ? "completed" : result.status === "error" ? "error" : "idle";
                dispatch({ type: "NODE_EXEC_STATE", nodeId: nid, state: execState });
              }
            }
            // Highlight the next node to be executed, or exit debug mode if completed
            const nextId = msg.payload.nextNodeId as string | undefined;
            if (nextId) {
              dispatch({ type: "NODE_EXEC_STATE", nodeId: nextId, state: "running" });
              dispatch({ type: "NODE_SELECTED", nodeId: nextId });
              dispatch({ type: "DEBUG_MODE", active: true });
            } else {
              // Debug session completed — exit debug mode
              dispatch({ type: "DEBUG_MODE", active: false });
            }
            break;
          }
          case "node:typesLoaded":
            setNodeTypesList((msg.payload.nodeTypes as INodeTypeMetadata[]) ?? []);
            break;
        }
      },
    );
    return () => subscription.dispose();
  }, []);

  // Trace: BD-02-004003 — Toolbar callbacks
  const handleExecute = useCallback(() => {
    messageClient.send("flow:execute", {});
  }, []);

  const handleStop = useCallback(() => {
    if (state.isDebugMode) {
      messageClient.send("debug:stop", {});
      dispatch({ type: "DEBUG_MODE", active: false });
    } else {
      messageClient.send("flow:stop", {});
    }
  }, [state.isDebugMode]);

  const handleDebugStart = useCallback(() => {
    messageClient.send("debug:start", {});
  }, []);

  const handleDebugStep = useCallback(() => {
    messageClient.send("debug:step", {});
  }, []);

  const handleSave = useCallback(() => {
    messageClient.send("flow:save", { nodes: state.nodes, edges: state.edges });
    dispatch({ type: "FLOW_SAVED" });
  }, [state.nodes, state.edges]);

  // Auto-save: debounce 3s after changes
  useEffect(() => {
    if (!state.isDirty) return;
    const timer = setTimeout(() => {
      messageClient.send("flow:save", { nodes: state.nodes, edges: state.edges });
      dispatch({ type: "FLOW_SAVED" });
    }, 3000);
    return () => clearTimeout(timer);
  }, [state.isDirty, state.nodes, state.edges]);

  // Trace: BD-02-004005 — FlowCanvas callbacks
  const handleNodesChange = useCallback((changes: unknown[]) => {
    const updatedNodes = applyNodeChanges(
      changes as NodeChange[],
      state.nodes as any[],
    );
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes as unknown as FlowNode[] });
  }, [state.nodes]);

  const handleEdgesChange = useCallback((changes: unknown[]) => {
    const updatedEdges = applyEdgeChanges(
      changes as EdgeChange[],
      state.edges as any[],
    );
    dispatch({ type: "EDGES_CHANGED", edges: updatedEdges as unknown as FlowEdge[] });
  }, [state.edges]);

  const handleConnect = useCallback((connection: Connection) => {
    const newEdge: FlowEdge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
    };
    pushState({ nodes: state.nodes, edges: state.edges });
    dispatch({ type: "EDGES_CHANGED", edges: [...state.edges, newEdge] });
  }, [state.nodes, state.edges, pushState]);

  const handleNodeClick = useCallback((nodeId: string) => {
    dispatch({ type: "NODE_SELECTED", nodeId });
  }, []);

  // Trace: DD-02-006002 — NodePalette D&D
  const handleNodeDrop = useCallback((nodeType: string, position: { x: number; y: number }) => {
    const metadata = nodeTypesList.find(m => m.nodeType === nodeType);
    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      type: nodeType,
      position,
      data: {
        label: metadata?.label ?? nodeType,
        settings: {},
      },
    };
    pushState({ nodes: state.nodes, edges: state.edges });
    dispatch({ type: "NODES_CHANGED", nodes: [...state.nodes, newNode] });
  }, [state.nodes, state.edges, nodeTypesList, pushState]);

  // Trace: DD-02-007004 — コンテキストメニュー操作
  const handleDeleteNode = useCallback((nodeId: string) => {
    pushState({ nodes: state.nodes, edges: state.edges });
    const updatedNodes = state.nodes.filter(n => n.id !== nodeId);
    const updatedEdges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes });
    dispatch({ type: "EDGES_CHANGED", edges: updatedEdges });
  }, [state.nodes, state.edges, pushState]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    pushState({ nodes: state.nodes, edges: state.edges });
    dispatch({ type: "EDGES_CHANGED", edges: state.edges.filter(e => e.id !== edgeId) });
  }, [state.nodes, state.edges, pushState]);

  // Trace: BD-02-004006 — PropertyPanel callbacks
  const handleSettingsChange = useCallback((nodeId: string, settings: NodeSettings) => {
    const updatedNodes = state.nodes.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, settings } } : n,
    );
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes });
  }, [state.nodes]);

  const handleLabelChange = useCallback((nodeId: string, label: string) => {
    const updatedNodes = state.nodes.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, label } } : n,
    );
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes });
  }, [state.nodes]);

  const handleEnabledChange = useCallback((nodeId: string, enabled: boolean) => {
    const updatedNodes = state.nodes.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, enabled } } : n,
    );
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes });
  }, [state.nodes]);

  // Trace: DD-02-007004 — Cut / Select All / Open Settings
  const handleCutNode = useCallback((nodeId: string) => {
    pushState({ nodes: state.nodes, edges: state.edges });
    const updatedNodes = state.nodes.filter(n => n.id !== nodeId);
    const updatedEdges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes });
    dispatch({ type: "EDGES_CHANGED", edges: updatedEdges });
  }, [state.nodes, state.edges, pushState]);

  const handleSelectAll = useCallback(() => {
    // ReactFlow ノードを全選択状態にする
    const selected = state.nodes.map(n => ({ ...n, selected: true }));
    dispatch({ type: "NODES_CHANGED", nodes: selected as FlowNode[] });
  }, [state.nodes]);

  const handleOpenSettings = useCallback((nodeId: string) => {
    dispatch({ type: "NODE_SELECTED", nodeId });
  }, []);

  // Trace: DD-02-007004 — ペースト（ゴースト配置）
  const handlePasteNode = useCallback((clipboard: { type: string; data: Record<string, unknown> }, position: { x: number; y: number }) => {
    const metadata = nodeTypesList.find(m => m.nodeType === clipboard.type);
    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      type: clipboard.type,
      position,
      data: {
        label: (clipboard.data.label as string) ?? metadata?.label ?? clipboard.type,
        settings: { ...((clipboard.data.settings as Record<string, unknown>) ?? {}) },
      },
    };
    pushState({ nodes: state.nodes, edges: state.edges });
    dispatch({ type: "NODES_CHANGED", nodes: [...state.nodes, newNode] });
  }, [state.nodes, state.edges, nodeTypesList, pushState]);

  // Trace: DD-02-007005 — Undo/Redo キーボードショートカット
  const handleUndo = useCallback(() => {
    const prevState = undo();
    if (prevState) {
      dispatch({ type: "NODES_CHANGED", nodes: prevState.nodes as FlowNode[] });
      dispatch({ type: "EDGES_CHANGED", edges: prevState.edges as FlowEdge[] });
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const nextState = redo();
    if (nextState) {
      dispatch({ type: "NODES_CHANGED", nodes: nextState.nodes as FlowNode[] });
      dispatch({ type: "EDGES_CHANGED", edges: nextState.edges as FlowEdge[] });
    }
  }, [redo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleSave]);

  // Trace: DD-02-007003 — ノードデータに ports / executionState を付与
  const enrichedNodes = useMemo(() => {
    return state.nodes.map(n => {
      const metadata = nodeTypesList.find(m => m.nodeType === n.type);
      return {
        ...n,
        data: {
          ...n.data,
          nodeType: n.type,
          enabled: (n.data.enabled as boolean) ?? true,
          ports: {
            inputs: metadata?.inputPorts ?? [],
            outputs: metadata?.outputPorts ?? [],
          },
          executionState: state.executionState.get(n.id) ?? "idle",
        },
      };
    });
  }, [state.nodes, nodeTypesList, state.executionState]);

  // Trace: BD-02-004001 — コンポーネント階層レイアウト
  return (
    <ReactFlowProvider>
      <div data-testid="flow-editor" className="fr-layout">
        <Toolbar
          isRunning={isRunning}
          isDebugMode={state.isDebugMode}
          isDirty={state.isDirty}
          onExecute={handleExecute}
          onStop={handleStop}
          onDebugStart={handleDebugStart}
          onDebugStep={handleDebugStep}
          onSave={handleSave}
          showMiniMap={showMiniMap}
          onToggleMiniMap={() => setShowMiniMap(p => !p)}
          leftPanelOpen={leftPanelOpen}
          onToggleLeftPanel={() => setLeftPanelOpen(p => !p)}
          rightPanelOpen={rightPanelOpen}
          onToggleRightPanel={() => setRightPanelOpen(p => !p)}
        />
        <div className="fr-main">
          {leftPanelOpen && (
            <div className="fr-sidebar-left">
              <NodePalette nodeTypes={nodePaletteItems} />
            </div>
          )}
          <div className="fr-canvas-area">
            <FlowCanvas
              nodes={enrichedNodes as unknown as Array<Record<string, unknown>>}
              edges={state.edges as unknown as Array<Record<string, unknown>>}
              executionState={state.executionState}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onNodeDrop={handleNodeDrop}
              onDeleteNode={handleDeleteNode}
              onDeleteEdge={handleDeleteEdge}
              onCutNode={handleCutNode}
              onPasteNode={handlePasteNode}
              onSelectAll={handleSelectAll}
              onOpenSettings={handleOpenSettings}
              showMiniMap={showMiniMap}
            />
          </div>
          {rightPanelOpen && (
            <div
              className="fr-resize-handle"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = rightPanelWidth;
                const onMove = (ev: MouseEvent) => {
                  const delta = startX - ev.clientX;
                  setRightPanelWidth(Math.max(200, Math.min(600, startWidth + delta)));
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
          )}
          {rightPanelOpen && (
            <div className="fr-sidebar-right" style={{ width: rightPanelWidth }}>
              <PropertyPanel
                selectedNode={selectedNodeForPanel}
                executionOutput={selectedNodeOutput}
                nodeMetadata={selectedNodeMetadata}
                onSettingsChange={handleSettingsChange}
                onLabelChange={handleLabelChange}
                onEnabledChange={handleEnabledChange}
                nodeType={selectedNode?.type}
              />
            </div>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
};
