// Trace: FEAT-00003-003002, FEAT-00003-003003, FEAT-00003-003004, FEAT-00003-003005, FEAT-00003-003007
import * as vscode from "vscode";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { NodeInstance, EdgeInstance } from "@shared/types/flow.js";

// Trace: FEAT-00003-003002
export class ChatParticipantHandler {
  constructor(
    private readonly flowService: IFlowService,
    private readonly executionService: IExecutionService,
  ) {}

  async handle(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    switch (request.command) {
      case "run":
        return this.handleRun(request, stream, token);
      case "list":
        return this.handleList(stream, token);
      case "create":
        return this.handleCreate(request, stream, token);
      default:
        return this.handleDefault(stream);
    }
  }

  // Trace: FEAT-00003-003003
  private async handleRun(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    const query = request.prompt.trim();
    if (!query) {
      stream.markdown("Please specify a flow name. Example: `@flowrunner /run my-flow`");
      return { metadata: { command: "run" } };
    }

    const flows = await this.flowService.listFlows();
    const match = flows.find(
      (f) => f.name.toLowerCase() === query.toLowerCase() || f.id === query,
    );

    if (!match) {
      // Partial match suggestions
      const candidates = flows.filter((f) =>
        f.name.toLowerCase().includes(query.toLowerCase()),
      );
      stream.markdown(`Flow not found: **${query}**\n\n`);
      if (candidates.length > 0) {
        stream.markdown("Did you mean:\n");
        for (const c of candidates) {
          stream.markdown(`- ${c.name}\n`);
        }
      }
      return { metadata: { command: "run" } };
    }

    stream.progress(`Executing flow: ${match.name}...`);

    if (token.isCancellationRequested) {
      stream.markdown("Cancelled.");
      return { metadata: { command: "run" } };
    }

    try {
      await this.executionService.executeFlow(match.id);
      stream.markdown(`**${match.name}** executed successfully.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      stream.markdown(`**${match.name}** failed: ${message}`);
    }

    return { metadata: { command: "run" } };
  }

  // Trace: FEAT-00003-003004
  private async handleList(
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    const flows = await this.flowService.listFlows();

    if (flows.length === 0) {
      stream.markdown("No flows found. Use `/create` to create a new flow.");
      return { metadata: { command: "list" } };
    }

    stream.markdown("| Name | ID | Updated |\n|---|---|---|\n");
    for (const f of flows) {
      if (token.isCancellationRequested) break;
      stream.markdown(`| ${f.name} | ${f.id} | ${f.updatedAt} |\n`);
    }

    return { metadata: { command: "list" } };
  }

  // Trace: FEAT-00003-003005
  private async handleCreate(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    const prompt = request.prompt.trim();
    if (!prompt) {
      stream.markdown(
        "Please describe the flow you want to create. Example: `@flowrunner /create A flow that runs build and test commands`",
      );
      return { metadata: { command: "create" } };
    }

    // Check if terminal history is requested
    const useTerminal = /terminal\s*histor|ターミナル履歴/i.test(prompt);
    let terminalContext = "";

    if (useTerminal) {
      const terminals = vscode.window.terminals;
      if (terminals.length > 0) {
        const latest = terminals[terminals.length - 1];
        const history = (latest as { shellIntegration?: { history?: string[] } })
          .shellIntegration?.history;
        if (history && history.length > 0) {
          terminalContext = `\nRecent terminal commands:\n${history.slice(-20).join("\n")}`;
        } else {
          stream.markdown(
            "Terminal history is not available. Please describe the flow manually.\n\n",
          );
        }
      }
    }

    stream.progress("Generating flow definition...");

    // Use Language Model API
    const model = request.model;
    if (!model) {
      stream.markdown("Language model is not available. Please try again.");
      return { metadata: { command: "create" } };
    }

    const systemPrompt = `You are FlowRunner, a workflow automation tool. Generate a valid FlowRunner flow definition as JSON.
Available node types: trigger, command, condition, loop, transform, log, http, file, subflow, comment, aiPrompt.
Each node has: id, type, label, enabled, position {x, y}, settings.
Edges connect nodes: {id, sourceNodeId, sourcePortId, targetNodeId, targetPortId}.
The flow must start with a trigger node (type: "trigger", settings: { triggerType: "manual" }).
Return ONLY valid JSON, no markdown fences.${terminalContext}`;

    try {
      const messages = [
        vscode.LanguageModelChatMessage.User(
          `${systemPrompt}\n\nCreate a flow for: ${prompt}`,
        ),
      ];

      const response = await model.sendRequest(messages, {}, token);

      let jsonText = "";
      for await (const chunk of response.text) {
        if (token.isCancellationRequested) {
          stream.markdown("Cancelled.");
          return { metadata: { command: "create" } };
        }
        jsonText += chunk;
      }

      // Strip markdown fences if present
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();

      const flowDef: { name?: string; nodes?: NodeInstance[]; edges?: EdgeInstance[] } = JSON.parse(jsonText) as {
        name?: string;
        nodes?: NodeInstance[];
        edges?: EdgeInstance[];
      };

      // Set required fields
      const flowName = flowDef.name ?? `Generated Flow ${Date.now()}`;
      const created = await this.flowService.createFlow(flowName);

      // Merge generated nodes/edges into the created flow
      if (flowDef.nodes) {
        created.nodes = flowDef.nodes;
      }
      if (flowDef.edges) {
        created.edges = flowDef.edges;
      }
      await this.flowService.saveFlow(created);

      stream.markdown(`Flow **${created.name}** created successfully!\n\n`);
      stream.button({
        command: "flowrunner.openEditor",
        title: vscode.l10n.t("Open in Editor"),
        arguments: [{ flowId: created.id }],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      stream.markdown(`Failed to create flow: ${message}`);
    }

    return { metadata: { command: "create" } };
  }

  // Trace: FEAT-00003-003002
  private handleDefault(stream: vscode.ChatResponseStream): vscode.ChatResult {
    stream.markdown(
      "**@flowrunner** commands:\n\n" +
        "- `/run <flow-name>` — Execute a flow\n" +
        "- `/list` — List all flows\n" +
        "- `/create <description>` — Create a new flow from a description\n",
    );
    return { metadata: { command: "help" } };
  }

  // Trace: FEAT-00003-003007
  provideFollowups(
    result: vscode.ChatResult,
  ): vscode.ChatFollowup[] {
    const command = (result.metadata as { command?: string })?.command;
    switch (command) {
      case "run":
        return [
          { prompt: "@flowrunner /list", label: "List all flows" },
        ];
      case "list":
        return [
          { prompt: "@flowrunner /create ", label: "Create a new flow" },
        ];
      case "create":
        return [
          { prompt: "@flowrunner /list", label: "List all flows" },
        ];
      default:
        return [
          { prompt: "@flowrunner /list", label: "List all flows" },
          { prompt: "@flowrunner /run ", label: "Run a flow" },
        ];
    }
  }
}
