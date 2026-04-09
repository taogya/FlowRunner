// Trace: DD-04-003003, DD-04-003004, DD-04-003005, DD-04-003006
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { DebugEvent, DebugPausedInputPreview } from "@shared/types/events.js";
import type { NodeResultMap } from "@shared/types/execution.js";
import type { PortDataMap, NodeInstance, EdgeInstance } from "@shared/types/flow.js";
import { VariableStore } from "@extension/interfaces/IVariableStore.js";
import { topologicalSort, buildInputs, findBodyNodes } from "./executionHelpers.js";

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
  // Trace: DD-04-003006 — loop step state
  private loopState: {
    loopNodeId: string;
    bodyNodes: NodeInstance[];
    iterations: unknown[];
    currentIteration: number;
    bodyData: unknown;
    doneOutput: unknown;
  } | null = null;
  private loopExecutedNodes = new Set<string>();
  // Trace: FEAT-00002-003004
  private variableStore = new VariableStore();

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
    this.loopState = null;
    this.loopExecutedNodes = new Set();
    // Trace: FEAT-00002-003004
    this.variableStore = new VariableStore();

    // Fire debug:paused with first node
    this.fireEvent({
      nextNodeId: this.sortedNodes[0].id,
      intermediateResults: { ...this.nodeResults },
      pausedInputPreview: this.createPausedInputPreview(this.sortedNodes[0].id),
    });
  }

  // Trace: DD-04-003004
  async step(): Promise<void> {
    if (!this.debugging) {
      throw new Error("No active debug session");
    }

    // Trace: DD-04-003006 — if in loop mode, execute one iteration
    if (this.loopState) {
      await this.stepLoopIteration();
      return;
    }

    if (this.cursor >= this.sortedNodes.length) {
      this.endDebug();
      return;
    }

    const currentNode = this.sortedNodes[this.cursor];

    // If current node is disabled, skipped, or already executed as loop body, advance past it
    if (currentNode.enabled === false || this.skippedNodes.has(currentNode.id) || this.loopExecutedNodes.has(currentNode.id)) {
      this.cursor++;

      // Skip any consecutive disabled/skipped/loop-executed nodes
      while (this.cursor < this.sortedNodes.length) {
        const n = this.sortedNodes[this.cursor];
        if (n.enabled !== false && !this.skippedNodes.has(n.id) && !this.loopExecutedNodes.has(n.id)) break;
        this.cursor++;
      }

      if (this.cursor >= this.sortedNodes.length) {
        await this.saveSuccessRecord();
        this.endDebug();
        return;
      }

      this.fireEvent({
        nextNodeId: this.sortedNodes[this.cursor].id,
        intermediateResults: { ...this.nodeResults },
        pausedInputPreview: this.createPausedInputPreview(this.sortedNodes[this.cursor].id),
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
      await this.saveErrorRecord();
      this.endDebug();
      return;
    }

    const inputs = buildInputs(currentNode.id, this.edges, this.outputMap);
    const context: IExecutionContext = {
      nodeId: currentNode.id,
      nodeLabel: currentNode.label,
      settings: currentNode.settings,
      inputs,
      flowId: this.flowId,
      signal: new AbortController().signal,
      variables: this.variableStore,
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
          this.markSkippedBranch(edge.targetNodeId);
        }
      }
    }

    // Trace: DD-04-003006 — loop handling: enter loop mode if loop node with body nodes
    if (currentNode.type === "loop" && result.status === "success") {
      const bodyNodeIds = findBodyNodes(currentNode.id, this.edges);
      if (bodyNodeIds.size > 0) {
        const bodyNodes = this.sortedNodes.filter(n => bodyNodeIds.has(n.id));
        const bodyData = result.outputs.body;
        const iterations = Array.isArray(bodyData) ? bodyData : bodyData != null ? [bodyData] : [];

        // Mark body nodes for skipping by main cursor (even if 0 iterations)
        for (const bn of bodyNodes) {
          this.loopExecutedNodes.add(bn.id);
        }

        if (iterations.length > 0 && bodyNodes.length > 0) {
          // Enter loop mode
          this.loopState = {
            loopNodeId: currentNode.id,
            bodyNodes,
            iterations,
            currentIteration: 0,
            bodyData,
            doneOutput: result.outputs.done,
          };

          // Set first iteration data
          this.outputMap.set(currentNode.id, { body: iterations[0] });

          // Fire debug:paused at first body node
          this.fireEvent({
            nextNodeId: bodyNodes[0].id,
            intermediateResults: { ...this.nodeResults },
            pausedInputPreview: this.createPausedInputPreview(bodyNodes[0].id),
          });
          return; // Don't advance cursor — loop mode handles it
        }

        // 0 iterations — set done output, fall through to normal advance
        this.outputMap.set(currentNode.id, { body: bodyData, done: result.outputs.done });
      }
    }

    this.cursor++;

    // Check if this was the last node
    let nextNodeIndex = this.cursor;
    while (nextNodeIndex < this.sortedNodes.length) {
      const nextNode = this.sortedNodes[nextNodeIndex];
      if (nextNode.enabled !== false && !this.skippedNodes.has(nextNode.id) && !this.loopExecutedNodes.has(nextNode.id)) {
        break;
      }
      nextNodeIndex++;
    }

    if (nextNodeIndex >= this.sortedNodes.length) {
      await this.saveSuccessRecord();
      this.endDebug();
      return;
    }

    this.cursor = nextNodeIndex;

    // Fire debug event with next node
    this.fireEvent({
      nextNodeId: this.sortedNodes[nextNodeIndex].id,
      intermediateResults: { ...this.nodeResults },
      pausedInputPreview: this.createPausedInputPreview(this.sortedNodes[nextNodeIndex].id),
    });
  }

  // Trace: DD-04-003006 — execute one loop iteration (all body nodes)
  private async stepLoopIteration(): Promise<void> {
    const state = this.loopState!;

    for (const bodyNode of state.bodyNodes) {
      if (bodyNode.enabled === false) continue;

      const executor = this.executorRegistry.get(bodyNode.type);
      const validation = executor.validate(bodyNode.settings);
      if (!validation.valid) {
        const errorMsg = `Validation failed for node ${bodyNode.id}: ${validation.errors?.map((e: { message: string }) => e.message).join(", ")}`;
        this.nodeResults[bodyNode.id] = {
          nodeId: bodyNode.id,
          nodeType: bodyNode.type,
          nodeLabel: bodyNode.label,
          status: "error",
          inputs: {},
          outputs: {},
          duration: 0,
          error: { message: errorMsg },
        };
        await this.saveErrorRecord();
        this.loopState = null;
        this.endDebug();
        return;
      }

      const inputs = buildInputs(bodyNode.id, this.edges, this.outputMap);
      const context: IExecutionContext = {
        nodeId: bodyNode.id,
        nodeLabel: bodyNode.label,
        settings: bodyNode.settings,
        inputs,
        flowId: this.flowId,
        signal: new AbortController().signal,
        variables: this.variableStore,
      };

      const result = await executor.execute(context);
      this.outputMap.set(bodyNode.id, result.outputs);

      this.nodeResults[bodyNode.id] = {
        nodeId: bodyNode.id,
        nodeType: bodyNode.type,
        nodeLabel: bodyNode.label,
        status: result.status,
        inputs,
        outputs: result.outputs,
        duration: result.duration,
      };

      if (result.status === "error") {
        await this.saveErrorRecord();
        this.loopState = null;
        this.endDebug();
        return;
      }
    }

    // Move to next iteration
    state.currentIteration++;

    if (state.currentIteration < state.iterations.length) {
      // More iterations — update output and pause at first body node
      this.outputMap.set(state.loopNodeId, { body: state.iterations[state.currentIteration] });
      this.fireEvent({
        nextNodeId: state.bodyNodes[0].id,
        intermediateResults: { ...this.nodeResults },
        pausedInputPreview: this.createPausedInputPreview(state.bodyNodes[0].id),
      });
    } else {
      // All iterations complete — restore done output and advance
      this.outputMap.set(state.loopNodeId, { body: state.bodyData, done: state.doneOutput });
      this.loopState = null;

      // Advance cursor past loop node and all body nodes
      this.cursor++;
      while (this.cursor < this.sortedNodes.length) {
        const n = this.sortedNodes[this.cursor];
        if (n.enabled !== false && !this.skippedNodes.has(n.id) && !this.loopExecutedNodes.has(n.id)) break;
        this.cursor++;
      }

      if (this.cursor >= this.sortedNodes.length) {
        await this.saveSuccessRecord();
        this.endDebug();
        return;
      }

      this.fireEvent({
        nextNodeId: this.sortedNodes[this.cursor].id,
        intermediateResults: { ...this.nodeResults },
        pausedInputPreview: this.createPausedInputPreview(this.sortedNodes[this.cursor].id),
      });
    }
  }

  private createPausedInputPreview(nodeId: string | undefined): DebugPausedInputPreview | undefined {
    if (!nodeId) {
      return undefined;
    }

    const node = this.sortedNodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return undefined;
    }

    return {
      nodeId: node.id,
      nodeType: node.type,
      nodeLabel: node.label,
      inputs: buildInputs(node.id, this.edges, this.outputMap),
    };
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

  private async saveSuccessRecord(): Promise<void> {
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
  }

  private async saveErrorRecord(): Promise<void> {
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
      pausedInputPreview: undefined,
    });
    this.debugging = false;
    this.sortedNodes = [];
    this.edges = [];
    this.cursor = 0;
    this.loopState = null;
  }

  private fireEvent(event: DebugEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }
}
