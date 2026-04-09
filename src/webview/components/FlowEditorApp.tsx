// Trace: DD-02-004001, DD-02-004002, DD-02-004003
import React, { useEffect, useReducer, useState, useCallback, useMemo, useRef } from "react";
import { ReactFlowProvider, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { NodeChange, EdgeChange, Connection, Node, Edge } from "@xyflow/react";
import { messageClient } from "../services/MessageClient.js";
import { FlowCanvas } from "./FlowCanvas.js";
import { Toolbar } from "./Toolbar.js";
import { PropertyPanel } from "./PropertyPanel.js";
import { LatestExecutionSummary } from "./LatestExecutionSummary.js";
import { ExecutionAnalyticsPanel } from "./ExecutionAnalyticsPanel.js";
import { FlowDependencyPanel } from "./FlowDependencyPanel.js";
import { NodePalette } from "./NodePalette.js";
import { useUndoRedo } from "../hooks/useUndoRedo.js";
import { DagreLayoutEngine } from "../services/DagreLayoutEngine.js";
import {
  getSelectedNodes,
  getInternalEdges,
  createRemappedNodes,
  remapEdges,
  placeNodesAroundCenter,
} from "../services/clipboardHelpers.js";
import { filterExistingEdgesForSameTarget } from "../services/connectionHelpers.js";
import {
  appendDebugExecutionSummaryItems,
  createExecutionSummaryItem,
  type LatestExecutionSummaryItem,
} from "../services/executionSummary.js";
import type { DebugPausedInputPreview } from "@shared/types/events.js";
import type { ExecutionAnalyticsSnapshot } from "@shared/types/analytics.js";
import type { FlowDependencySnapshot } from "@shared/types/dependencies.js";
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
  selected?: boolean;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  selected?: boolean;
}

// Trace: DD-02-004002 — FlowEditorAction
export type FlowEditorAction =
  | { type: "FLOW_LOADED"; nodes: FlowNode[]; edges: FlowEdge[] }
  | { type: "NODES_CHANGED"; nodes: FlowNode[] }
  | { type: "EDGES_CHANGED"; edges: FlowEdge[] }
  | { type: "NODE_SELECTED"; nodeId: string | null }
  | { type: "NODE_EXEC_STATE"; nodeId: string; state: NodeExecState }
  | { type: "EXECUTION_STATE_SNAPSHOT"; executionState: Map<string, NodeExecState> }
  | { type: "EXECUTION_STATE_RESET" }
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
    case "EXECUTION_STATE_SNAPSHOT":
      return { ...state, executionState: new Map(action.executionState) };
    case "EXECUTION_STATE_RESET":
      return { ...state, executionState: new Map() };
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
  const currentFlowIdRef = useRef<string | null>(null);
  const pendingPasteFromClipboardRef = useRef(false);
  const [nodeTypesList, setNodeTypesList] = useState<INodeTypeMetadata[]>([]);
  const [executionResults, setExecutionResults] = useState<Map<string, NodeResult>>(new Map());
  const [latestExecutionSummary, setLatestExecutionSummary] = useState<
    LatestExecutionSummaryItem[]
  >([]);
  const [executionAnalytics, setExecutionAnalytics] = useState<ExecutionAnalyticsSnapshot | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [flowDependencies, setFlowDependencies] = useState<FlowDependencySnapshot | null>(null);
  const [isDependencyLoading, setIsDependencyLoading] = useState(false);
  const [focusedSummaryNodeId, setFocusedSummaryNodeId] = useState<string | null>(null);
  const [currentDebugNodeId, setCurrentDebugNodeId] = useState<string | null>(null);
  const [pausedInputPreview, setPausedInputPreview] = useState<DebugPausedInputPreview | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const { pushState, undo, redo } = useUndoRedo();

  // Trace: REV-016 #10 — clipboard for multi-node copy/paste
  const [clipboard, setClipboard] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);
  const [nodeClipboard, setNodeClipboard] = useState<{ type: string; data: Record<string, unknown> } | null>(null);

  // Ghost paste mode: nodes follow cursor until user clicks to place
  const [ghostPaste, setGhostPaste] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);

  // Trigger state
  const [isTriggerActive, setIsTriggerActive] = useState(false);

  // Trace: DD-02-004002 — 派生ステート
  const isRunning = useMemo(
    () => Array.from(state.executionState.values()).some(s => s === "running"),
    [state.executionState],
  );

  // Check if flow has a non-manual trigger node
  const hasTriggerNode = useMemo(() => {
    const triggerNode = state.nodes.find(n => n.type === "trigger");
    if (!triggerNode) return false;
    const tt = (triggerNode.data?.settings as Record<string, unknown>)?.triggerType;
    return tt === "schedule" || tt === "fileChange";
  }, [state.nodes]);

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

  const selectedNodeInputPreview = useMemo(() => {
    if (!state.selectedNodeId) {
      return null;
    }
    if (executionResults.has(state.selectedNodeId)) {
      return null;
    }
    if (!pausedInputPreview || pausedInputPreview.nodeId !== state.selectedNodeId) {
      return null;
    }
    return pausedInputPreview;
  }, [state.selectedNodeId, executionResults, pausedInputPreview]);

  const currentDebugNodeLabel = useMemo(() => {
    if (!currentDebugNodeId) {
      return null;
    }
    const debugNode = state.nodes.find((node) => node.id === currentDebugNodeId);
    if (!debugNode) {
      return null;
    }
    return (debugNode.data.label as string) ?? debugNode.type;
  }, [currentDebugNodeId, state.nodes]);

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

  // Trace: DD-02-004003 — mount 時に flow:load / node:getTypes / trigger:getStatus メッセージ送信
  useEffect(() => {
    messageClient.send("flow:load", {});
    messageClient.send("node:getTypes", {});
    messageClient.send("trigger:getStatus", {});
    // Trace: FEAT-00021 — エディタ起動時に共有クリップボードを同期
    messageClient.send("clipboard:get", {});
  }, []);

  // Trace: FEAT-00021 — 単一ノード貼り付けと複数ノード貼り付けで同じ共有ソースを使う
  const applySharedClipboard = useCallback((nextClipboard: { nodes: FlowNode[]; edges: FlowEdge[] } | null) => {
    if (!nextClipboard || nextClipboard.nodes.length === 0) {
      setClipboard(null);
      setNodeClipboard(null);
      return;
    }

    const clonedClipboard = structuredClone(nextClipboard) as { nodes: FlowNode[]; edges: FlowEdge[] };
    setClipboard(clonedClipboard);
    if (clonedClipboard.nodes.length === 1) {
      const [singleNode] = clonedClipboard.nodes;
      setNodeClipboard({
        type: singleNode.type,
        data: structuredClone(singleNode.data),
      });
      return;
    }

    setNodeClipboard(null);
  }, []);

  const enterGhostPasteFromClipboard = useCallback((selectionClipboard: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
    if (selectionClipboard.nodes.length === 0) {
      return;
    }

    const { newNodes, idMap } = createRemappedNodes(selectionClipboard.nodes, 0, () => crypto.randomUUID());
    const newEdges = remapEdges(selectionClipboard.edges, idMap).map((edge, index) => ({
      ...edge,
      id: `e-${idMap.get(selectionClipboard.edges[index].source)}-${idMap.get(selectionClipboard.edges[index].target)}-${Date.now()}`,
    }));
    setGhostPaste({ nodes: newNodes as FlowNode[], edges: newEdges });
  }, []);

  const requestExecutionAnalytics = useCallback(() => {
    setIsAnalyticsLoading(true);
    messageClient.send("history:analyticsLoad", {});
  }, []);

  const requestFlowDependencies = useCallback(() => {
    if (!currentFlowIdRef.current) {
      return;
    }
    setIsDependencyLoading(true);
    messageClient.send("dependency:load", {});
  }, []);

  // Trace: DD-02-004003 — メッセージハンドリング
  useEffect(() => {
    const subscription = messageClient.onMessage(
      (msg: { type: string; payload: Record<string, unknown> }) => {
        switch (msg.type) {
          case "flow:loaded": {
            // Trace: DD-02-004003 — NodeInstance/EdgeInstance → FlowNode/FlowEdge 変換
            const flow = msg.payload.flow as Record<string, unknown> | undefined;
            const loadedFlowId =
              typeof flow?.id === "string"
                ? flow.id
                : typeof msg.payload.flowId === "string"
                  ? msg.payload.flowId
                  : null;
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
            setExecutionResults(new Map());
            setLatestExecutionSummary([]);
            setExecutionAnalytics(null);
            setIsAnalyticsLoading(false);
            setFlowDependencies(null);
            setIsDependencyLoading(false);
            setFocusedSummaryNodeId(null);
            setCurrentDebugNodeId(null);
            setPausedInputPreview(null);
            currentFlowIdRef.current = loadedFlowId;
            dispatch({ type: "FLOW_LOADED", nodes, edges });
            if (loadedFlowId) {
              requestExecutionAnalytics();
              requestFlowDependencies();
            }
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
              setLatestExecutionSummary((prev) => [
                ...prev,
                createExecutionSummaryItem(
                  msg.payload.result as NodeResult,
                  prev.length + 1,
                ),
              ]);
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
              setLatestExecutionSummary((prev) => [
                ...prev,
                createExecutionSummaryItem(
                  msg.payload.result as NodeResult,
                  prev.length + 1,
                ),
              ]);
            }
            break;
          case "execution:flowCompleted":
            if (currentFlowIdRef.current) {
              requestExecutionAnalytics();
            }
            break;
          case "debug:paused": {
            // Trace: DD-02-004002 — update node execution states from intermediateResults
            const results = msg.payload.intermediateResults as Record<string, NodeResult> | undefined;
            const nextExecutionState = new Map<string, NodeExecState>();
            if (results) {
              const nextResults = new Map(Object.entries(results) as Array<[string, NodeResult]>);
              setExecutionResults((previousResults) => {
                setLatestExecutionSummary((previousItems) =>
                  appendDebugExecutionSummaryItems(
                    previousResults,
                    nextResults,
                    previousItems,
                  ),
                );
                return nextResults;
              });
              for (const [nid, result] of Object.entries(results)) {
                const execState: NodeExecState = result.status === "success" ? "completed" : result.status === "error" ? "error" : "idle";
                nextExecutionState.set(nid, execState);
              }
            } else {
              setExecutionResults(new Map());
            }
            // Highlight the next node to be executed, or exit debug mode if completed
            const nextId = msg.payload.nextNodeId as string | undefined;
            setPausedInputPreview(
              (msg.payload.pausedInputPreview as DebugPausedInputPreview | undefined) ?? null,
            );
            if (nextId) {
              nextExecutionState.set(nextId, "running");
            }
            dispatch({ type: "EXECUTION_STATE_SNAPSHOT", executionState: nextExecutionState });
            setCurrentDebugNodeId(nextId ?? null);
            if (nextId) {
              dispatch({ type: "NODE_SELECTED", nodeId: nextId });
              dispatch({ type: "DEBUG_MODE", active: true });
            } else {
              // Debug session completed — exit debug mode
              dispatch({ type: "DEBUG_MODE", active: false });
              if (currentFlowIdRef.current) {
                requestExecutionAnalytics();
              }
            }
            break;
          }
          case "history:analyticsLoaded": {
            const payloadFlowId =
              typeof msg.payload.flowId === "string" ? msg.payload.flowId : null;
            if (payloadFlowId !== currentFlowIdRef.current) {
              break;
            }
            setExecutionAnalytics(
              (msg.payload.snapshot as ExecutionAnalyticsSnapshot | null | undefined) ?? null,
            );
            setIsAnalyticsLoading(false);
            break;
          }
          case "dependency:loaded": {
            const payloadFlowId =
              typeof msg.payload.flowId === "string" ? msg.payload.flowId : null;
            if (payloadFlowId !== currentFlowIdRef.current) {
              break;
            }
            setFlowDependencies(
              (msg.payload.snapshot as FlowDependencySnapshot | null | undefined) ?? null,
            );
            setIsDependencyLoading(false);
            break;
          }
          case "flow:indexChanged":
            if (currentFlowIdRef.current) {
              requestFlowDependencies();
            }
            break;
          // Trace: FEAT-00021 — 他フロー由来の clipboard:loaded でも貼り付け可能にする
          case "clipboard:loaded": {
            const rawNodes = Array.isArray(msg.payload.nodes) ? msg.payload.nodes : [];
            const rawEdges = Array.isArray(msg.payload.edges) ? msg.payload.edges : [];
            const sharedClipboard = rawNodes.length > 0
              ? {
                  nodes: rawNodes as FlowNode[],
                  edges: rawEdges as FlowEdge[],
                }
              : null;

            applySharedClipboard(sharedClipboard);
            if (pendingPasteFromClipboardRef.current) {
              pendingPasteFromClipboardRef.current = false;
              if (sharedClipboard) {
                enterGhostPasteFromClipboard(sharedClipboard);
              }
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
          case "trigger:statusChanged":
            setIsTriggerActive((msg.payload.active as boolean) ?? false);
            break;
        }
      },
    );
    return () => subscription.dispose();
  }, [applySharedClipboard, enterGhostPasteFromClipboard, requestExecutionAnalytics, requestFlowDependencies]);

  // Trace: BD-02-004003 — Toolbar callbacks
  const handleExecute = useCallback(() => {
    setExecutionResults(new Map());
    setLatestExecutionSummary([]);
    setExecutionAnalytics(null);
    setIsAnalyticsLoading(false);
    setFocusedSummaryNodeId(null);
    setCurrentDebugNodeId(null);
    setPausedInputPreview(null);
    dispatch({ type: "EXECUTION_STATE_RESET" });
    // Save before execute to ensure the latest flow is used
    if (state.isDirty) {
      messageClient.send("flow:save", { nodes: state.nodes, edges: state.edges });
      dispatch({ type: "FLOW_SAVED" });
    }
    messageClient.send("flow:execute", {});
  }, [state.isDirty, state.nodes, state.edges]);

  const handleTriggerActivate = useCallback(() => {
    if (state.isDirty) {
      messageClient.send("flow:save", { nodes: state.nodes, edges: state.edges });
      dispatch({ type: "FLOW_SAVED" });
    }
    messageClient.send("trigger:activate", {});
  }, [state.isDirty, state.nodes, state.edges]);

  const handleTriggerDeactivate = useCallback(() => {
    messageClient.send("trigger:deactivate", {});
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
    setExecutionResults(new Map());
    setLatestExecutionSummary([]);
    setExecutionAnalytics(null);
    setIsAnalyticsLoading(false);
    setFocusedSummaryNodeId(null);
    setCurrentDebugNodeId(null);
    setPausedInputPreview(null);
    dispatch({ type: "EXECUTION_STATE_RESET" });
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

  const handleDependencyRefresh = useCallback(() => {
    requestFlowDependencies();
  }, [requestFlowDependencies]);

  const handleDependencyOpen = useCallback((targetFlowId: string) => {
    messageClient.send("dependency:openFlow", { targetFlowId });
  }, []);

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
    const NODE_WIDTH = 160;
    const NODE_HEIGHT = 60;
    const metadata = nodeTypesList.find(m => m.nodeType === nodeType);
    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      type: nodeType,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
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

  // Trace: FEAT-00021 — 右クリックコピー/カットも共有クリップボードへ集約
  const handleCanvasClipboardChange = useCallback((selectionClipboard: { nodes: FlowNode[]; edges: [] }) => {
    applySharedClipboard(selectionClipboard);
    messageClient.send("clipboard:set", selectionClipboard);
  }, [applySharedClipboard]);

  // Trace: REV-016 #10 — deselect all nodes / edges
  const handleDeselectAll = useCallback(() => {
    const deselected = state.nodes.map(n => ({ ...n, selected: false }));
    const deselectedEdges = state.edges.map(e => ({ ...e, selected: false }));
    dispatch({ type: "NODES_CHANGED", nodes: deselected as FlowNode[] });
    dispatch({ type: "EDGES_CHANGED", edges: deselectedEdges as FlowEdge[] });
    dispatch({ type: "NODE_SELECTED", nodeId: null });
  }, [state.nodes, state.edges]);

  // Trace: REV-016 #10 — copy selected nodes + internal edges to clipboard
  const handleCopySelected = useCallback(() => {
    const selectedNodes = getSelectedNodes(state.nodes);
    if (selectedNodes.length === 0) return;
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const internalEdges = getInternalEdges(state.edges, selectedIds);
    const nextClipboard = { nodes: selectedNodes, edges: internalEdges };
    applySharedClipboard(nextClipboard);
    messageClient.send("clipboard:set", nextClipboard);
  }, [applySharedClipboard, state.nodes, state.edges]);

  // Trace: REV-016 #10 — cut selected nodes (copy + delete)
  const handleCutSelected = useCallback(() => {
    const selectedNodes = getSelectedNodes(state.nodes);
    if (selectedNodes.length === 0) return;
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const internalEdges = getInternalEdges(state.edges, selectedIds);
    const nextClipboard = { nodes: selectedNodes, edges: internalEdges };
    applySharedClipboard(nextClipboard);
    messageClient.send("clipboard:set", nextClipboard);
    pushState({ nodes: state.nodes, edges: state.edges });
    const remainingNodes = state.nodes.filter(n => !selectedIds.has(n.id));
    const remainingEdges = state.edges.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target));
    dispatch({ type: "NODES_CHANGED", nodes: remainingNodes });
    dispatch({ type: "EDGES_CHANGED", edges: remainingEdges });
  }, [applySharedClipboard, state.nodes, state.edges, pushState]);

  // Trace: REV-016 #10 — paste clipboard: enter ghost mode for placement
  const handlePasteSelected = useCallback(() => {
    pendingPasteFromClipboardRef.current = true;
    messageClient.send("clipboard:get", {});
  }, []);

  // Confirm ghost paste: place nodes at clicked flow position
  const handleGhostPasteConfirm = useCallback((flowPosition: { x: number; y: number }) => {
    if (!ghostPaste) return;
    pushState({ nodes: state.nodes, edges: state.edges });
    const placedNodes = placeNodesAroundCenter(ghostPaste.nodes, flowPosition);
    const deselectedNodes = state.nodes.map(n => ({ ...n, selected: false }));
    dispatch({ type: "NODES_CHANGED", nodes: [...deselectedNodes, ...placedNodes] });
    dispatch({ type: "EDGES_CHANGED", edges: [...state.edges, ...ghostPaste.edges] });
    setGhostPaste(null);
  }, [ghostPaste, state.nodes, state.edges, pushState]);

  // Cancel ghost paste
  const handleGhostPasteCancel = useCallback(() => {
    setGhostPaste(null);
  }, []);

  // Trace: REV-016 #10 — duplicate selected nodes: enter ghost mode for placement
  const handleDuplicateSelected = useCallback(() => {
    const selectedNodes = getSelectedNodes(state.nodes);
    if (selectedNodes.length === 0) return;
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const internalEdges = getInternalEdges(state.edges, selectedIds);
    const { newNodes, idMap } = createRemappedNodes(selectedNodes, 0, () => crypto.randomUUID());
    const newEdges = remapEdges(internalEdges, idMap).map((e, i) => ({
      ...e,
      id: `e-${idMap.get(internalEdges[i].source)}-${idMap.get(internalEdges[i].target)}-${Date.now()}`,
    }));
    setGhostPaste({ nodes: newNodes as FlowNode[], edges: newEdges });
  }, [state.nodes, state.edges]);

  // Trace: REV-016 #10 — delete selected nodes and edges
  const handleDeleteSelected = useCallback(() => {
    const selectedNodes = getSelectedNodes(state.nodes);
    const selectedEdges = state.edges.filter(e => (e as unknown as { selected?: boolean }).selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const selectedEdgeIds = new Set(selectedEdges.map(e => e.id));
    pushState({ nodes: state.nodes, edges: state.edges });
    const remainingNodes = state.nodes.filter(n => !selectedNodeIds.has(n.id));
    const remainingEdges = state.edges.filter(e =>
      !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target),
    );
    dispatch({ type: "NODES_CHANGED", nodes: remainingNodes });
    dispatch({ type: "EDGES_CHANGED", edges: remainingEdges });
  }, [state.nodes, state.edges, pushState]);

  const handleOpenSettings = useCallback((nodeId: string) => {
    dispatch({ type: "NODE_SELECTED", nodeId });
  }, []);

  const handleSummarySelect = useCallback((nodeId: string) => {
    if (!state.nodes.some((node) => node.id === nodeId)) {
      return;
    }
    dispatch({ type: "NODE_SELECTED", nodeId });
    setFocusedSummaryNodeId(nodeId);
  }, [state.nodes]);

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
    const selected = getSelectedNodes(state.nodes);
    const isPartial = selected.length >= 2;
    const targetNodes = isPartial ? selected : state.nodes;
    const targetIds = new Set(targetNodes.map(n => n.id));
    const targetEdges = state.edges.filter(e => targetIds.has(e.source) && targetIds.has(e.target));
    const layoutNodes = targetNodes.map(n => ({
      id: n.id,
      position: n.position,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));
    const layoutEdges = targetEdges.map(e => ({
      source: e.source,
      target: e.target,
    }));
    const result = layoutEngine.layout(layoutNodes, layoutEdges, {
      direction: "LR",
      nodeSpacing: 50,
      rankSpacing: 100,
    });
    // When laying out selected nodes only, preserve the centroid position
    let offsetX = 0;
    let offsetY = 0;
    if (isPartial && result.length > 0) {
      const origCx = targetNodes.reduce((s, n) => s + n.position.x, 0) / targetNodes.length;
      const origCy = targetNodes.reduce((s, n) => s + n.position.y, 0) / targetNodes.length;
      const newCx = result.reduce((s, r) => s + r.position.x, 0) / result.length;
      const newCy = result.reduce((s, r) => s + r.position.y, 0) / result.length;
      offsetX = origCx - newCx;
      offsetY = origCy - newCy;
    }
    pushState({ nodes: state.nodes, edges: state.edges });
    const updatedNodes = state.nodes.map(n => {
      const laid = result.find(r => r.id === n.id);
      return laid ? { ...n, position: { x: laid.position.x + offsetX, y: laid.position.y + offsetY } } : n;
    });
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes });
  }, [state.nodes, state.edges, layoutEngine, pushState]);

  // Auto layout: Top → Bottom (vertical)
  const handleAutoLayoutVertical = useCallback(() => {
    const NODE_WIDTH = 160;
    const NODE_HEIGHT = 60;
    const selected = getSelectedNodes(state.nodes);
    const isPartial = selected.length >= 2;
    const targetNodes = isPartial ? selected : state.nodes;
    const targetIds = new Set(targetNodes.map(n => n.id));
    const targetEdges = state.edges.filter(e => targetIds.has(e.source) && targetIds.has(e.target));
    const layoutNodes = targetNodes.map(n => ({
      id: n.id,
      position: n.position,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));
    const layoutEdges = targetEdges.map(e => ({
      source: e.source,
      target: e.target,
    }));
    const result = layoutEngine.layout(layoutNodes, layoutEdges, {
      direction: "TB",
      nodeSpacing: 50,
      rankSpacing: 100,
    });
    // When laying out selected nodes only, preserve the centroid position
    let offsetX = 0;
    let offsetY = 0;
    if (isPartial && result.length > 0) {
      const origCx = targetNodes.reduce((s, n) => s + n.position.x, 0) / targetNodes.length;
      const origCy = targetNodes.reduce((s, n) => s + n.position.y, 0) / targetNodes.length;
      const newCx = result.reduce((s, r) => s + r.position.x, 0) / result.length;
      const newCy = result.reduce((s, r) => s + r.position.y, 0) / result.length;
      offsetX = origCx - newCx;
      offsetY = origCy - newCy;
    }
    pushState({ nodes: state.nodes, edges: state.edges });
    const updatedNodes = state.nodes.map(n => {
      const laid = result.find(r => r.id === n.id);
      return laid ? { ...n, position: { x: laid.position.x + offsetX, y: laid.position.y + offsetY } } : n;
    });
    dispatch({ type: "NODES_CHANGED", nodes: updatedNodes });
  }, [state.nodes, state.edges, layoutEngine, pushState]);

  // Align selected nodes' X coordinate (vertical column)
  const handleAlignX = useCallback(() => {
    const selected = getSelectedNodes(state.nodes);
    if (selected.length < 2) return;
    const avgX = selected.reduce((sum, n) => sum + (n as FlowNode).position.x, 0) / selected.length;
    pushState({ nodes: state.nodes, edges: state.edges });
    const selectedIds = new Set(selected.map(n => n.id));
    const updated = state.nodes.map(n =>
      selectedIds.has(n.id) ? { ...n, position: { ...n.position, x: avgX } } : n,
    );
    dispatch({ type: "NODES_CHANGED", nodes: updated });
  }, [state.nodes, state.edges, pushState]);

  // Align selected nodes' Y coordinate (horizontal row)
  const handleAlignY = useCallback(() => {
    const selected = getSelectedNodes(state.nodes);
    if (selected.length < 2) return;
    const avgY = selected.reduce((sum, n) => sum + (n as FlowNode).position.y, 0) / selected.length;
    pushState({ nodes: state.nodes, edges: state.edges });
    const selectedIds = new Set(selected.map(n => n.id));
    const updated = state.nodes.map(n =>
      selectedIds.has(n.id) ? { ...n, position: { ...n.position, y: avgY } } : n,
    );
    dispatch({ type: "NODES_CHANGED", nodes: updated });
  }, [state.nodes, state.edges, pushState]);

  // Trace: DD-02-007005 — Undo/Redo キーボードショートカット
  const handleUndo = useCallback(() => {
    const prevState = undo({ nodes: state.nodes, edges: state.edges });
    if (prevState) {
      dispatch({ type: "NODES_CHANGED", nodes: prevState.nodes as FlowNode[] });
      dispatch({ type: "EDGES_CHANGED", edges: prevState.edges as FlowEdge[] });
    }
  }, [undo, state.nodes, state.edges]);

  const handleRedo = useCallback(() => {
    const nextState = redo({ nodes: state.nodes, edges: state.edges });
    if (nextState) {
      dispatch({ type: "NODES_CHANGED", nodes: nextState.nodes as FlowNode[] });
      dispatch({ type: "EDGES_CHANGED", edges: nextState.edges as FlowEdge[] });
    }
  }, [redo, state.nodes, state.edges]);

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
        if (ghostPaste) {
          handleGhostPasteCancel();
        } else {
          handleDeselectAll();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        handleDeleteSelected();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleSave, handleSelectAll, handleCopySelected, handlePasteSelected, handleCutSelected, handleDuplicateSelected, handleDeselectAll, handleDeleteSelected, ghostPaste, handleGhostPasteCancel]);

  // Trace: DD-02-007003 — ノードデータに ports / executionState を付与
  const enrichedNodes = useMemo(() => {
    return state.nodes.map(n => {
      const metadata = nodeTypesList.find(m => m.nodeType === n.type);
      return {
        ...n,
        selected: n.id === state.selectedNodeId || n.selected === true,
        data: {
          ...n.data,
          nodeType: n.type,
          debugPaused: n.id === currentDebugNodeId,
          enabled: (n.data.enabled as boolean) ?? true,
          ports: {
            inputs: metadata?.inputPorts ?? [],
            outputs: metadata?.outputPorts ?? [],
          },
          executionState: state.executionState.get(n.id) ?? "idle",
        },
      };
    });
  }, [state.nodes, nodeTypesList, state.executionState, state.selectedNodeId, currentDebugNodeId]);

  // Trace: BD-02-004001 — コンポーネント階層レイアウト
  return (
    <ReactFlowProvider>
      <div data-testid="flow-editor" className="fr-layout">
        <Toolbar
          isRunning={isRunning}
          isDebugMode={state.isDebugMode}
          debugNodeLabel={currentDebugNodeLabel}
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
          onAutoLayoutVertical={handleAutoLayoutVertical}
          onAlignX={handleAlignX}
          onAlignY={handleAlignY}
          hasSelection={getSelectedNodes(state.nodes).length >= 2}
          isTriggerActive={isTriggerActive}
          hasTriggerNode={hasTriggerNode}
          onTriggerActivate={handleTriggerActivate}
          onTriggerDeactivate={handleTriggerDeactivate}
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
              focusedNodeId={focusedSummaryNodeId}
              onFocusedNodeHandled={() => setFocusedSummaryNodeId(null)}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onNodeDrop={handleNodeDrop}
              onDeleteNode={handleDeleteNode}
              onDeleteEdge={handleDeleteEdge}
              onDeleteSelected={handleDeleteSelected}
              onClipboardSelectionChange={handleCanvasClipboardChange}
              onCutNode={handleCutNode}
              clipboardNode={nodeClipboard}
              onPasteNode={handlePasteNode}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onOpenSettings={handleOpenSettings}
              onAutoLayout={handleAutoLayout}
              showMiniMap={showMiniMap}
              ghostPasteNodeCount={ghostPaste ? ghostPaste.nodes.length : 0}
              ghostPasteFirstType={ghostPaste?.nodes[0]?.type}
              ghostPasteFirstLabel={ghostPaste?.nodes[0]?.data?.label as string | undefined}
              onGhostPasteConfirm={handleGhostPasteConfirm}
              onGhostPasteCancel={handleGhostPasteCancel}
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
              <LatestExecutionSummary
                items={latestExecutionSummary}
                onSelectNode={handleSummarySelect}
              />
              <ExecutionAnalyticsPanel
                snapshot={executionAnalytics}
                isLoading={isAnalyticsLoading}
              />
              <FlowDependencyPanel
                snapshot={flowDependencies}
                isLoading={isDependencyLoading}
                onRefresh={handleDependencyRefresh}
                onOpenFlow={handleDependencyOpen}
              />
              <PropertyPanel
                selectedNode={selectedNodeForPanel}
                executionOutput={selectedNodeOutput}
                inputPreview={selectedNodeInputPreview}
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
