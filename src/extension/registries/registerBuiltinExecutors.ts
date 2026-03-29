// Trace: DD-03-002004
import type * as vscode from "vscode";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { IFlowRepository } from "@extension/interfaces/IFlowRepository.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import { TriggerExecutor } from "@extension/executors/TriggerExecutor.js";
import { CommandExecutor } from "@extension/executors/CommandExecutor.js";
import { LogExecutor } from "@extension/executors/LogExecutor.js";
import { AIPromptExecutor } from "@extension/executors/AIPromptExecutor.js";
import { ConditionExecutor } from "@extension/executors/ConditionExecutor.js";
import { LoopExecutor } from "@extension/executors/LoopExecutor.js";
import { SubFlowExecutor } from "@extension/executors/SubFlowExecutor.js";
import { FileExecutor } from "@extension/executors/FileExecutor.js";
import { HttpExecutor } from "@extension/executors/HttpExecutor.js";
import { TransformExecutor } from "@extension/executors/TransformExecutor.js";
import { CommentExecutor } from "@extension/executors/CommentExecutor.js";

// Trace: DD-03-002004
export interface BuiltinExecutorDeps {
  outputChannel: vscode.OutputChannel;
  flowRepository: IFlowRepository;
  executionService: IExecutionService;
}

export function registerBuiltinExecutors(
  registry: INodeExecutorRegistry,
  deps: BuiltinExecutorDeps,
): void {
  registry.register("trigger", new TriggerExecutor());
  registry.register("command", new CommandExecutor(deps.outputChannel));
  registry.register("log", new LogExecutor(deps.outputChannel));
  registry.register("aiPrompt", new AIPromptExecutor());
  registry.register("condition", new ConditionExecutor());
  registry.register("loop", new LoopExecutor());
  registry.register("subFlow", new SubFlowExecutor(deps.flowRepository, deps.executionService));
  registry.register("file", new FileExecutor());
  registry.register("http", new HttpExecutor(deps.outputChannel));
  registry.register("transform", new TransformExecutor());
  registry.register("comment", new CommentExecutor());
}
