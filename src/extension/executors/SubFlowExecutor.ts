// Trace: DD-03-007003
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { IFlowRepository } from "@extension/interfaces/IFlowRepository.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";

// Trace: BD-03-006011
export class SubFlowExecutor implements INodeExecutor {
  // Trace: DD-03-007003
  private readonly flowRepository: IFlowRepository;
  private readonly executionService: IExecutionService;

  constructor(flowRepository: IFlowRepository, executionService: IExecutionService) {
    this.flowRepository = flowRepository;
    this.executionService = executionService;
  }

  // Trace: BD-03-006011
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "subFlow",
    label: "フロー連携",
    icon: "subFlow",
    category: "制御",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [{ id: "out", label: "出力", dataType: "any" }],
    settingsSchema: [
      { key: "flowId", label: "フロー", type: "select", required: true },
      { key: "outputNodeId", label: "出力ノード", type: "select", required: false, description: "サブフローの出力に使用するノード（未選択時は最終ノード）" },
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  // Trace: BD-03-006011, REV-016 #12 — dynamically populate flowId and outputNodeId options
  async getMetadataAsync(currentSettings?: NodeSettings): Promise<INodeTypeMetadata> {
    const flows = await this.flowRepository.list();
    const flowIdSetting = {
      key: "flowId",
      label: "フロー",
      type: "select" as const,
      required: true,
      options: flows.map((f) => ({ value: f.id, label: f.name })),
    };

    // Build outputNodeId options from terminal nodes of the selected flow
    let outputNodeOptions: Array<{ value: string; label: string }> = [];
    const selectedFlowId = currentSettings?.flowId as string | undefined;
    if (selectedFlowId) {
      try {
        const flow = await this.flowRepository.load(selectedFlowId);
        const sourceNodeIds = new Set(flow.edges.map(e => e.sourceNodeId));
        const terminalNodes = flow.nodes.filter(n => !sourceNodeIds.has(n.id));
        outputNodeOptions = terminalNodes.map(n => ({ value: n.id, label: n.label || n.type }));
      } catch {
        // Flow not found or load error — leave options empty
      }
    }

    return {
      ...this.metadata,
      settingsSchema: [
        flowIdSetting,
        {
          key: "outputNodeId",
          label: "出力ノード",
          type: "select",
          required: false,
          description: "サブフローの出力に使用するノード（未選択時は最終ノード）",
          options: outputNodeOptions,
        },
      ],
    };
  }

  validate(settings: NodeSettings): ValidationResult {
    if (!settings.flowId) {
      return { valid: false, errors: [{ field: "flowId", message: "flowId is required" }] };
    }
    return { valid: true };
  }

  // Trace: DD-03-007003, DD-04-002009
  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }

    const subFlowId = context.settings.flowId as string;
    if (!subFlowId) {
      return {
        status: "error",
        outputs: {},
        error: { message: "flowId is not set" },
        duration: 0,
      };
    }

    // Trace: DD-03-007003 — circular call detection
    if (this.executionService.isRunning(subFlowId)) {
      return {
        status: "error",
        outputs: {},
        error: { message: `Circular sub-flow call detected: ${subFlowId} is already running` },
        duration: 0,
      };
    }

    const exists = await this.flowRepository.exists(subFlowId);
    if (!exists) {
      return {
        status: "error",
        outputs: {},
        error: { message: `Flow not found: ${subFlowId}` },
        duration: 0,
      };
    }

    const currentDepth = context.depth ?? 0;
    const outputNodeId = context.settings.outputNodeId as string | undefined;
    const startMs = Date.now();
    try {
      // Trace: DD-04-002009, REV-016 #12 — sub-flow execution with depth tracking and output node selection
      const subFlowOutput = await this.executionService.executeFlow(subFlowId, {
        depth: currentDepth + 1,
        outputNodeId: outputNodeId || undefined,
      });

      return {
        status: "success",
        outputs: { out: subFlowOutput?.out ?? subFlowOutput },
        duration: Date.now() - startMs,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "error",
        outputs: {},
        error: { message },
        duration: Date.now() - startMs,
      };
    }
  }
}
