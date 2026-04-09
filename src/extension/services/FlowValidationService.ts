import * as vscode from "vscode";
import * as path from "path";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type {
  FlowValidationCategory,
  FlowValidationIssue,
  FlowValidationMode,
  FlowValidationSeverity,
  IFlowValidationService,
} from "@extension/interfaces/IFlowValidationService.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { ValidationError } from "@shared/types/execution.js";
import type {
  EdgeInstance,
  FlowDefinition,
  NodeInstance,
  NodeSettings,
} from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";

const FILE_OPERATIONS = new Set([
  "read",
  "write",
  "append",
  "delete",
  "exists",
  "listDir",
]);

const SEVERITY_ORDER: Record<FlowValidationSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function isBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() === "";
}

function hasOutgoingEdge(
  edges: EdgeInstance[],
  nodeId: string,
  portId: string,
): boolean {
  return edges.some(
    (edge) => edge.sourceNodeId === nodeId && edge.sourcePortId === portId,
  );
}

function getRequiredPorts(nodeType: string): string[] {
  switch (nodeType) {
    case "condition":
      return ["true", "false"];
    case "loop":
      return ["body", "done"];
    case "tryCatch":
      return ["try", "done"];
    case "parallel":
      return ["done"];
    default:
      return [];
  }
}

function normalizeIssueKey(issue: FlowValidationIssue): string {
  return [
    issue.nodeId ?? "flow",
    issue.category,
    issue.field ?? "",
    issue.message,
  ].join(":");
}

export function sortFlowValidationIssues(
  issues: FlowValidationIssue[],
): FlowValidationIssue[] {
  return [...issues].sort((left, right) => {
    const severityDelta =
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const leftLabel = left.nodeLabel ?? left.nodeId ?? "";
    const rightLabel = right.nodeLabel ?? right.nodeId ?? "";
    return leftLabel.localeCompare(rightLabel, "ja");
  });
}

// Trace: FEAT-00015-003001, FEAT-00015-003002, FEAT-00015-003004
export class FlowValidationService implements IFlowValidationService {
  constructor(
    private readonly flowService: IFlowService,
    private readonly nodeExecutorRegistry: INodeExecutorRegistry,
  ) {}

  async validateFlow(
    flowId: string,
    mode: FlowValidationMode,
  ): Promise<FlowValidationIssue[]> {
    const flow = await this.flowService.getFlow(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    return this.validateDefinition(flow, mode);
  }

  async validateDefinition(
    flow: FlowDefinition,
    _mode: FlowValidationMode,
  ): Promise<FlowValidationIssue[]> {
    const issues: FlowValidationIssue[] = [];
    const seen = new Set<string>();

    for (const node of flow.nodes) {
      if (node.enabled === false) {
        continue;
      }

      const executor = this.tryGetExecutor(node.type);
      if (!executor) {
        this.pushIssue(
          issues,
          seen,
          this.createIssue(
            "high",
            "unknown-node",
            node,
            `未対応のノード種別です: ${node.type}`,
          ),
        );
        continue;
      }

      const metadata = executor.getMetadata();
      await this.addCustomIssues(flow, node, metadata, issues, seen);

      const validation = executor.validate(node.settings);
      if (!validation.valid) {
        for (const error of validation.errors ?? []) {
          this.pushIssue(
            issues,
            seen,
            this.mapValidationError(node, error),
          );
        }
      }
    }

    return sortFlowValidationIssues(issues);
  }

  private tryGetExecutor(nodeType: string) {
    try {
      return this.nodeExecutorRegistry.get(nodeType);
    } catch {
      return undefined;
    }
  }

  private async addCustomIssues(
    flow: FlowDefinition,
    node: NodeInstance,
    metadata: INodeTypeMetadata,
    issues: FlowValidationIssue[],
    seen: Set<string>,
  ): Promise<void> {
    switch (node.type) {
      case "aiPrompt":
        if (isBlankString(node.settings.model) || !node.settings.model) {
          this.pushIssue(
            issues,
            seen,
            this.createIssue(
              "high",
              "ai-model-missing",
              node,
              "AI モデルが未選択です",
              "model",
            ),
          );
        }
        break;
      case "subFlow":
        await this.addSubFlowIssues(node, issues, seen);
        break;
      case "file":
        this.addFileIssues(node, issues, seen);
        break;
      case "trigger":
        this.addTriggerIssues(node, issues, seen);
        break;
    }

    for (const portId of getRequiredPorts(node.type)) {
      if (!hasOutgoingEdge(flow.edges, node.id, portId)) {
        const portLabel =
          metadata.outputPorts.find((port) => port.id === portId)?.label ?? portId;
        this.pushIssue(
          issues,
          seen,
          this.createIssue(
            "medium",
            "important-port-unconnected",
            node,
            `${portLabel} ポートが未接続です`,
            portId,
          ),
        );
      }
    }
  }

  private async addSubFlowIssues(
    node: NodeInstance,
    issues: FlowValidationIssue[],
    seen: Set<string>,
  ): Promise<void> {
    const subFlowId = node.settings.flowId;
    if (isBlankString(subFlowId) || !subFlowId) {
      this.pushIssue(
        issues,
        seen,
        this.createIssue(
          "high",
          "unresolved-subflow",
          node,
          "参照先フローが未設定です",
          "flowId",
        ),
      );
      return;
    }

    const exists = await this.flowService.existsFlow(String(subFlowId));
    if (!exists) {
      this.pushIssue(
        issues,
        seen,
        this.createIssue(
          "high",
          "unresolved-subflow",
          node,
          `参照先フローが見つかりません: ${String(subFlowId)}`,
          "flowId",
        ),
      );
    }
  }

  private addFileIssues(
    node: NodeInstance,
    issues: FlowValidationIssue[],
    seen: Set<string>,
  ): void {
    const operation = node.settings.operation;
    const filePath = node.settings.path;

    if (!operation || !FILE_OPERATIONS.has(String(operation))) {
      this.pushIssue(
        issues,
        seen,
        this.createIssue(
          "high",
          "file-configuration",
          node,
          "ファイル操作の operation が不正または未設定です",
          "operation",
        ),
      );
    }

    if (filePath == null) {
      this.pushIssue(
        issues,
        seen,
        this.createIssue(
          "high",
          "file-configuration",
          node,
          "ファイルパスが未設定です",
          "path",
        ),
      );
      return;
    }

    if (isBlankString(filePath)) {
      this.pushIssue(
        issues,
        seen,
        this.createIssue(
          "medium",
          "dangerous-empty",
          node,
          "ファイルパスが空文字のままです",
          "path",
        ),
      );
      return;
    }

    if (typeof filePath === "string" && !path.isAbsolute(filePath)) {
      const normalized = path.normalize(filePath);
      if (normalized.startsWith("..")) {
        this.pushIssue(
          issues,
          seen,
          this.createIssue(
            "high",
            "file-configuration",
            node,
            "相対パスの親ディレクトリ参照は使用できません",
            "path",
          ),
        );
      }
    }
  }

  private addTriggerIssues(
    node: NodeInstance,
    issues: FlowValidationIssue[],
    seen: Set<string>,
  ): void {
    const triggerType = String(node.settings.triggerType ?? "manual");

    if (triggerType === "fileChange") {
      const filePattern = node.settings.filePattern;
      if (!filePattern || isBlankString(filePattern)) {
        this.pushIssue(
          issues,
          seen,
          this.createIssue(
            "medium",
            "trigger-configuration",
            node,
            "ファイル変更監視のパターンが未設定です",
            "filePattern",
          ),
        );
      }
    }

    if (triggerType === "schedule") {
      const interval = Number(node.settings.intervalSeconds);
      if (
        node.settings.intervalSeconds == null ||
        Number.isNaN(interval) ||
        interval < 5
      ) {
        this.pushIssue(
          issues,
          seen,
          this.createIssue(
            "medium",
            "trigger-configuration",
            node,
            "スケジュール実行の intervalSeconds は 5 以上で設定してください",
            "intervalSeconds",
          ),
        );
      }
    }
  }

  private mapValidationError(
    node: NodeInstance,
    error: ValidationError,
  ): FlowValidationIssue {
    if (node.type === "trigger") {
      return this.createIssue(
        "medium",
        "trigger-configuration",
        node,
        error.message,
        error.field,
      );
    }

    if (node.type === "file") {
      if (isBlankString(node.settings.path)) {
        return this.createIssue(
          "medium",
          "dangerous-empty",
          node,
          "ファイルパスが空文字のままです",
          error.field,
        );
      }
      return this.createIssue(
        "high",
        "file-configuration",
        node,
        error.message,
        error.field,
      );
    }

    if (node.type === "aiPrompt" && error.field === "model") {
      return this.createIssue(
        "high",
        "ai-model-missing",
        node,
        "AI モデルが未選択です",
        error.field,
      );
    }

    if (node.type === "subFlow" && error.field === "flowId") {
      return this.createIssue(
        "high",
        "unresolved-subflow",
        node,
        error.message,
        error.field,
      );
    }

    const localizedMessage = vscode.l10n.t(error.message);

    return this.createIssue(
      "high",
      "required-setting",
      node,
      localizedMessage,
      error.field,
    );
  }

  private createIssue(
    severity: FlowValidationSeverity,
    category: FlowValidationCategory,
    node: NodeInstance,
    message: string,
    field?: string,
  ): FlowValidationIssue {
    return {
      severity,
      category,
      message,
      nodeId: node.id,
      nodeLabel: node.label,
      field,
    };
  }

  private pushIssue(
    issues: FlowValidationIssue[],
    seen: Set<string>,
    issue: FlowValidationIssue,
  ): void {
    const key = normalizeIssueKey(issue);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    issues.push(issue);
  }
}