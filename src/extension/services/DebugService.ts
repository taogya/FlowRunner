// Trace: DD-04-003003, DD-04-003004, DD-04-003005, DD-04-003006
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { DebugEvent } from "@shared/types/events.js";
import type { NodeResultMap } from "@shared/types/execution.js";
import type { PortDataMap, NodeInstance, EdgeInstance } from "@shared/types/flow.js";
import { topologicalSort, buildInputs } from "./executionHelpers.js";

interface FlowService {
  getFlow(flowId: string): Promise<{
    id: string;
    name: string;
    nodes: NodeInstance[];
    edges: EdgeInstance[];
  } | null>;
}

type EventHandler = (event: DebugEvent) => void;

export class DebugService {
  private readonly flowService: FlowService;
  private readonly executorRegistry: INodeExecutorRegistry;
  private readonly historyService: IHistoryService;
  private readonly eventHandlers: EventHandler[] = [];

  private debugging = false;
  private sortedNodes: NodeInstance[] = [];
  private edges: EdgeInstance[] = [];
  private cursor = 0;
  private outputMap = new Map<string, PortDataMap>();
  private nodeResults: NodeResultMap = {};
  private flowId = "";
  private flowName = "";
  private skippedNodes = new Set<string>();

  constructor(
    flowService: FlowService,
    executorRegistry: INodeExecutorRegistry,
    historyService: IHistoryService,
  ) {
    this.flowService = flowService;
    this.executorRegistry = executorRegistry;
    this.historyService = historyService;
  }

  // Trace: DD-04-003003
  async startDebug(flowId: string): Promise<void> {
    if (this.debugging) {
      throw new Error("Debug session is already active");
    }

    const flow = await this.flowService.getFlow(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    this.debugging = true;
    this.flowId = flowId;
    this.flowName = flow.name;
    this.sortedNodes = topologicalSort(flow.nodes, flow.edges);
    this.edges = flow.edges;
    this.cursor = 0;
    this.outputMap = new Map();
    this.nodeResults = {};
    this.skippedNodes = new Set();

    // Fire debug:paused with first node
    this.fireEvent({
      nextNodeId: this.sortedNodes[0].id,
      intermediateResults: { ...this.nodeResults },
    });
  }

  // Trace: DD-04-003004
  async step(): Promise<void> {
    if (!this.debugging) {
      throw new Error("No active debug session");
    }

    if (this.cursor >= this.sortedNodes.length) {
      this.endDebug();
      return;
    }

    const currentNode = this.sortedNodes[this.cursor];

    // If current node is disabled or in a skipped branch, advance past it without executing
    if (currentNode.enabled === false || this.skippedNodes.has(currentNode.id)) {
      this.cursor++;

      // Skip any consecutive disabled/skipped nodes
      while (this.cursor < this.sortedNodes.length) {
        const n = this.sortedNodes[this.cursor];
        if (n.enabled !== false && !this.skippedNodes.has(n.id)) break;
        this.cursor++;
      }

      if (this.cursor >= this.sortedNodes.length) {
        await this.historyService.saveRecord({
          id: `${this.flowId}_${Date.now()}`,
          flowId: this.flowId,
          flowName: this.flowName,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          duration: 0,
          status: "success",
          nodeResults: Object.values(this.nodeResults),
        });
        this.endDebug();
        return;
      }

      this.fireEvent({
        nextNodeId: this.sortedNodes[this.cursor].id,
        intermediateResults: { ...this.nodeResults },
      });
      return;
    }

    // Execute the current enabled node
    const executor = this.executorRegistry.get(currentNode.type);

    // Validate
    const validation = executor.validate(currentNode.settings);
    if (!validation.valid) {
      const errorMsg = `Validation failed for node ${currentNode.id}: ${validation.errors?.map((e: { message: string }) => e.message).join(", ")}`;
      this.nodeResults[currentNode.id] = {
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        nodeLabel: currentNode.label,
        status: "error",
        inputs: {},
        outputs: {},
        duration: 0,
        error: { message: errorMsg },
      };
      await this.historyService.saveRecord({
        id: `${this.flowId}_${Date.now()}`,
        flowId: this.flowId,
        flowName: this.flowName,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0,
        status: "error",
        nodeResults: Object.values(this.nodeResults),
      });
      this.endDebug();
      return;
    }

    const inputs = buildInputs(currentNode.id, this.edges, this.outputMap);
    const context: IExecutionContext = {
      nodeId: currentNode.id,
      settings: currentNode.settings,
      inputs,
      flowId: this.flowId,
      signal: new AbortController().signal,
    };

    const result = await executor.execute(context);
    this.outputMap.set(currentNode.id, result.outputs);

    // Store node result
    this.nodeResults[currentNode.id] = {
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeLabel: currentNode.label,
      status: result.status,
      inputs,
      outputs: result.outputs,
      duration: result.duration,
    };

    // Trace: DD-04-003006 — condition branching: find unselected paths
    if (currentNode.type === "condition") {
      const outputPorts = new Set(Object.keys(result.outputs));
      for (const edge of this.edges) {
        if (
          edge.sourceNodeId === currentNode.id &&
          !outputPorts.has(edge.sourcePortId)
        ) {
          // BFS to find all nodes reachable from the unselected port
          this.markSkippedBranch(edge.targetNodeId);
        }
      }
    }

    this.cursor++;

    // Check if this was the last node
    let nextNodeIndex = this.cursor;
    while (nextNodeIndex < this.sortedNodes.length) {
      const nextNode = this.sortedNodes[nextNodeIndex];
      if (nextNode.enabled !== false && !this.skippedNodes.has(nextNode.id)) {
        break;
      }
      nextNodeIndex++;
    }

    if (nextNodeIndex >= this.sortedNodes.length) {
      // Last node — save record and end debug
      await this.historyService.saveRecord({
        id: `${this.flowId}_${Date.now()}`,
        flowId: this.flowId,
        flowName: this.flowName,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0,
        status: "success",
        nodeResults: Object.values(this.nodeResults),
      });
      this.endDebug();
      return;
    }

    // Fire debug event with next node
    this.fireEvent({
      nextNodeId: this.sortedNodes[nextNodeIndex].id,
      intermediateResults: { ...this.nodeResults },
    });
  }

  private markSkippedBranch(startNodeId: string): void {
    const queue = [startNodeId];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (this.skippedNodes.has(nodeId)) continue;
      this.skippedNodes.add(nodeId);
      for (const edge of this.edges) {
        if (edge.sourceNodeId === nodeId) {
          queue.push(edge.targetNodeId);
        }
      }
    }
  }

  stopDebug(): void {
    this.endDebug();
  }

  isDebugging(): boolean {
    return this.debugging;
  }

  // Trace: DD-04-003005
  getIntermediateResults(): NodeResultMap {
    return { ...this.nodeResults };
  }

  onDebugEvent(handler: EventHandler): { dispose(): void } {
    this.eventHandlers.push(handler);
    return {
      dispose: () => {
        const idx = this.eventHandlers.indexOf(handler);
        if (idx >= 0) this.eventHandlers.splice(idx, 1);
      },
    };
  }

  private endDebug(): void {
    // Fire completion event so WebView can exit debug mode
    this.fireEvent({
      nextNodeId: undefined,
      intermediateResults: { ...this.nodeResults },
    });
    this.debugging = false;
    this.sortedNodes = [];
    this.edges = [];
    this.cursor = 0;
  }

  private fireEvent(event: DebugEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }
}
