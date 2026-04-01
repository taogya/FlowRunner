// Trace: DD-02-004001, DD-02-004002, DD-02-004003
import React, { useEffect, useReducer, useState, useCallback, useMemo } from "react";
import { ReactFlowProvider, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { NodeChange, EdgeChange, Connection, Node, Edge } from "@xyflow/react";
import { messageClient } from "../services/MessageClient.js";
import { FlowCanvas } from "./FlowCanvas.js";
import { Toolbar } from "./Toolbar.js";
import { PropertyPanel } from "./PropertyPanel.js";
import { NodePalette } from "./NodePalette.js";
import { useUndoRedo } from "../hooks/useUndoRedo.js";
import { DagreLayoutEngine } from "../services/DagreLayoutEngine.js";
import { getSelectedNodes, getInternalEdges, createRemappedNodes, remapEdges } from "../services/clipboardHelpers.js";
import { filterExistingEdgesForSameTarget } from "../services/connectionHelpers.js";
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

  // Trace: REV-016 #10 — clipboard for multi-node copy/paste
  const [clipboard, setClipboard] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);

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

  // Trace: REV-016 #12 — dynamic metadata for nodes with settings-dependent options (e.g. SubFlow)
  const [dynamicMetadata, setDynamicMetadata] = useState<INodeTypeMetadata | null>(null);

  const effectiveNodeMetadata = useMemo(() => {
    if (dynamicMetadata && selectedNode && dynamicMetadata.nodeType === selectedNode.type) {
      return dynamicMetadata;
    }
    return selectedNodeMetadata;
  }, [dynamicMetadata, selectedNode, selectedNodeMetadata]);

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

  // Trace: REV-016 #12 — request dynamic metadata when selecting a node with getMetadataAsync support
  useEffect(() => {
    if (!selectedNode) {
      setDynamicMetadata(null);
      return;
    }
    // Only request dynamic metadata for node types that need it (e.g. subFlow)
    const needsDynamic = selectedNode.type === "subFlow" || selectedNode.type === "aiPrompt";
    if (!needsDynamic) {
      setDynamicMetadata(null);
      return;
    }
    const settings = (selectedNode.data.settings as Record<string, unknown>) ?? {};
    messageClient.send("node:getMetadata", { nodeType: selectedNode.type, settings });
  }, [selectedNode]);

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
            const rawNodes = ((flow?.nodes ?? msg.payload.nodes) ?? []) as Record<string, unknown>[];
            const rawEdges = ((flow?.edges ?? msg.payload.edges) ?? []) as Record<string, unknown>[];
            const nodes: FlowNode[] = rawNodes.map((n: Record<string, unknown>) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data ?? { label: n.label, enabled: n.enabled, settings: n.settings },
            }));
            const edges: FlowEdge[] = rawEdges.map((e: Record<string, unknown>) => ({
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
            if (msg.payload.result) {
              setExecutionResults(prev => {
                const next = new Map(prev);
                next.set(msg.payload.nodeId as string, msg.payload.result as NodeResult);
                return next;
              });
            }
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
          // Trace: REV-016 #12 — dynamic metadata response
          case "node:metadataLoaded":
            setDynamicMetadata(msg.payload.metadata as INodeTypeMetadata);
            break;
        }
      },
    );
    return () => subscription.dispose();
  }, []);

  // Trace: BD-02-004003 — Toolbar callbacks
  const handleExecute = useCallback(() => {
    // Save before execute to ensure the latest flow is used
    if (state.isDirty) {
      messageClient.send("flow:save", { nodes: state.nodes, edges: state.edges });
      dispatch({ type: "FLOW_SAVED" });
    }
    messageClient.send("flow:execute", {});
  }, [state.isDirty, state.nodes, state.edges]);

  const handleStop = useCallback(() => {
    if (state.isDebugMode) {
      messageClient.send("debug:stop", {});
      dispatch({ type: "DEBUG_MODE", active: false });
    } else {
      messageClient.send("flow:stop", {});
    }
  }, [state.isDebugMode]);

  const handleDebugStart = useCallback(() => {
    // Save before debug to ensure the latest flow is used
    if (state.isDirty) {
      messageClient.send("flow:save", { nodes: state.nodes, edges: state.edges });
      dispatch({ type: "FLOW_SAVED" });
    }
    messageClient.send("debug:start", {});
  }, [state.isDirty, state.nodes, state.edges]);

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
      state.nodes as unknown as Node[],
    );
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes as unknown as FlowNode[] });
  }, [state.nodes]);

  const handleEdgesChange = useCallback((changes: unknown[]) => {
    const updatedEdges = applyEdgeChanges(
      changes as EdgeChange[],
      state.edges as unknown as Edge[],
    );
    dispatch({ type: "EDGES_CHANGED", edges: updatedEdges as unknown as FlowEdge[] });
  }, [state.edges]);

  const handleConnect = useCallback((connection: Connection) => {
    const targetHandle = connection.targetHandle ?? undefined;
    const newEdge: FlowEdge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle,
    };
    pushState({ nodes: state.nodes, edges: state.edges });
    // Trace: REV-016 #5 — 1入力1接続: 同一ターゲットポートへの既存エッジを除去
    const filteredEdges = filterExistingEdgesForSameTarget(state.edges, connection.target, targetHandle);
    dispatch({ type: "EDGES_CHANGED", edges: [...filteredEdges, newEdge] });
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
    // Trace: REV-016 #12 — refresh dynamic metadata when settings change (e.g. SubFlow flowId)
    const node = state.nodes.find(n => n.id === nodeId);
    if (node && (node.type === "subFlow" || node.type === "aiPrompt")) {
      messageClient.send("node:getMetadata", { nodeType: node.type, settings });
    }
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

  // Trace: REV-016 #10 — deselect all nodes
  const handleDeselectAll = useCallback(() => {
    const deselected = state.nodes.map(n => ({ ...n, selected: false }));
    dispatch({ type: "NODES_CHANGED", nodes: deselected as FlowNode[] });
    dispatch({ type: "NODE_SELECTED", nodeId: null });
  }, [state.nodes]);

  // Trace: REV-016 #10 — copy selected nodes + internal edges to clipboard
  const handleCopySelected = useCallback(() => {
    const selectedNodes = getSelectedNodes(state.nodes);
    if (selectedNodes.length === 0) return;
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const internalEdges = getInternalEdges(state.edges, selectedIds);
    setClipboard({ nodes: selectedNodes, edges: internalEdges });
  }, [state.nodes, state.edges]);

  // Trace: REV-016 #10 — cut selected nodes (copy + delete)
  const handleCutSelected = useCallback(() => {
    const selectedNodes = getSelectedNodes(state.nodes);
    if (selectedNodes.length === 0) return;
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const internalEdges = getInternalEdges(state.edges, selectedIds);
    setClipboard({ nodes: selectedNodes, edges: internalEdges });
    pushState({ nodes: state.nodes, edges: state.edges });
    const remainingNodes = state.nodes.filter(n => !selectedIds.has(n.id));
    const remainingEdges = state.edges.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target));
    dispatch({ type: "NODES_CHANGED", nodes: remainingNodes });
    dispatch({ type: "EDGES_CHANGED", edges: remainingEdges });
  }, [state.nodes, state.edges, pushState]);

  // Trace: REV-016 #10 — paste clipboard at offset position
  const handlePasteSelected = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;
    pushState({ nodes: state.nodes, edges: state.edges });
    const OFFSET = 50;
    const { newNodes, idMap } = createRemappedNodes(clipboard.nodes, OFFSET, () => crypto.randomUUID());
    const newEdges = remapEdges(clipboard.edges, idMap).map((e, i) => ({
      ...e,
      id: `e-${idMap.get(clipboard.edges[i].source)}-${idMap.get(clipboard.edges[i].target)}-${Date.now()}`,
    }));
    // Deselect existing nodes
    const deselectedNodes = state.nodes.map(n => ({ ...n, selected: false }));
    dispatch({ type: "NODES_CHANGED", nodes: [...deselectedNodes, ...newNodes] as FlowNode[] });
    dispatch({ type: "EDGES_CHANGED", edges: [...state.edges, ...newEdges] });
  }, [clipboard, state.nodes, state.edges, pushState]);

  // Trace: REV-016 #10 — duplicate selected nodes in place
  const handleDuplicateSelected = useCallback(() => {
    const selectedNodes = getSelectedNodes(state.nodes);
    if (selectedNodes.length === 0) return;
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const internalEdges = getInternalEdges(state.edges, selectedIds);
    pushState({ nodes: state.nodes, edges: state.edges });
    const OFFSET = 50;
    const { newNodes, idMap } = createRemappedNodes(selectedNodes, OFFSET, () => crypto.randomUUID());
    const newEdges = remapEdges(internalEdges, idMap).map((e, i) => ({
      ...e,
      id: `e-${idMap.get(internalEdges[i].source)}-${idMap.get(internalEdges[i].target)}-${Date.now()}`,
    }));
    const deselectedNodes = state.nodes.map(n => ({ ...n, selected: false }));
    dispatch({ type: "NODES_CHANGED", nodes: [...deselectedNodes, ...newNodes] as FlowNode[] });
    dispatch({ type: "EDGES_CHANGED", edges: [...state.edges, ...newEdges] });
  }, [state.nodes, state.edges, pushState]);

  // Trace: REV-016 #10 — delete selected nodes
  const handleDeleteSelected = useCallback(() => {
    const selectedNodes = getSelectedNodes(state.nodes);
    if (selectedNodes.length === 0) return;
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    pushState({ nodes: state.nodes, edges: state.edges });
    const remainingNodes = state.nodes.filter(n => !selectedIds.has(n.id));
    const remainingEdges = state.edges.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target));
    dispatch({ type: "NODES_CHANGED", nodes: remainingNodes });
    dispatch({ type: "EDGES_CHANGED", edges: remainingEdges });
  }, [state.nodes, state.edges, pushState]);

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

  // Trace: REV-016 #8 — Auto layout using pluggable layout engine
  const layoutEngine = useMemo(() => new DagreLayoutEngine(), []);
  const handleAutoLayout = useCallback(() => {
    // Default node dimensions (matching CSS fr-node approximate size)
    const NODE_WIDTH = 160;
    const NODE_HEIGHT = 60;
    const layoutNodes = state.nodes.map(n => ({
      id: n.id,
      position: n.position,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));
    const layoutEdges = state.edges.map(e => ({
      source: e.source,
      target: e.target,
    }));
    const result = layoutEngine.layout(layoutNodes, layoutEdges, {
      direction: "LR",
      nodeSpacing: 50,
      rankSpacing: 100,
    });
    pushState({ nodes: state.nodes, edges: state.edges });
    const updatedNodes = state.nodes.map(n => {
      const laid = result.find(r => r.id === n.id);
      return laid ? { ...n, position: laid.position } : n;
    });
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes });
  }, [state.nodes, state.edges, layoutEngine, pushState]);

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
      // Skip shortcuts when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const mod = e.ctrlKey || e.metaKey;
      // Trace: DD-02-007005 — Cmd+Shift+Z (macOS redo) must be checked before Cmd+Z
      if (mod && e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        handleRedo();
      } else if (mod && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
      } else if (mod && e.key === "y") {
        e.preventDefault();
        handleRedo();
      } else if (mod && e.key === "s") {
        e.preventDefault();
        handleSave();
      // Trace: REV-016 #10 — selection/clipboard shortcuts
      } else if (mod && e.key === "a") {
        e.preventDefault();
        handleSelectAll();
      } else if (mod && e.key === "c") {
        e.preventDefault();
        handleCopySelected();
      } else if (mod && e.key === "v") {
        e.preventDefault();
        handlePasteSelected();
      } else if (mod && e.key === "x") {
        e.preventDefault();
        handleCutSelected();
      } else if (mod && e.key === "d") {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === "Escape") {
        handleDeselectAll();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        handleDeleteSelected();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleSave, handleSelectAll, handleCopySelected, handlePasteSelected, handleCutSelected, handleDuplicateSelected, handleDeselectAll, handleDeleteSelected]);

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
          onAutoLayout={handleAutoLayout}
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
              onAutoLayout={handleAutoLayout}
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
                nodeMetadata={effectiveNodeMetadata}
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
