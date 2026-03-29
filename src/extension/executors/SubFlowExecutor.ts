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
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  // Trace: BD-03-006011 — dynamically populate flowId options from repository
  async getMetadataAsync(): Promise<INodeTypeMetadata> {
    const flows = await this.flowRepository.list();
    return {
      ...this.metadata,
      settingsSchema: [
        {
          key: "flowId",
          label: "フロー",
          type: "select",
          required: true,
          options: flows.map((f) => ({ value: f.id, label: f.name })),
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
    const startMs = Date.now();
    try {
      // Trace: DD-04-002009 — sub-flow execution with depth tracking
      const subFlowOutput = await this.executionService.executeFlow(subFlowId, { depth: currentDepth + 1 });

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
