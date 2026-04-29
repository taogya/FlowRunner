// BD-03 INodeExecutor インターフェース IT tests
// Trace: BD-03-002001 INodeExecutor 概要,
//        BD-03-002003 IExecutionContext,
//        BD-03-002004 IExecutionResult,
//        BD-03-002005 ValidationResult

import { describe, it, expect } from "vitest";
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { ValidationResult, ValidationError } from "@shared/types/execution.js";
import { CommandExecutor } from "@extension/executors/CommandExecutor.js";
import { TriggerExecutor } from "@extension/executors/TriggerExecutor.js";
import { CommentExecutor } from "@extension/executors/CommentExecutor.js";

// --- BD-03-002001: INodeExecutor 概要 ---

describe("INodeExecutor Overview (BD-03-002001)", () => {
  // BDIT-03-002001-00001
  it("allExecutors_implementINodeExecutor_haveThreeMethods", () => {
    const executors: INodeExecutor[] = [
      new TriggerExecutor(),
      new CommandExecutor(),
      new CommentExecutor(),
    ];

    for (const executor of executors) {
      expect(typeof executor.execute).toBe("function");
      expect(typeof executor.validate).toBe("function");
      expect(typeof executor.getMetadata).toBe("function");
    }
  });

  // BDIT-03-002001-00002
  it("execute_isAsync_returnsPromise", () => {
    const executor: INodeExecutor = new TriggerExecutor();
    const context: IExecutionContext = {
      nodeId: "n1",
      settings: {},
      inputs: {},
      flowId: "f1",
      signal: new AbortController().signal,
    };

    const result = executor.execute(context);
    expect(result).toBeInstanceOf(Promise);
  });
});

// --- BD-03-002003: IExecutionContext ---

describe("IExecutionContext (BD-03-002003)", () => {
  // BDIT-03-002003-00001
  it("executionContext_hasAllRequiredFields", () => {
    const context: IExecutionContext = {
      nodeId: "node-1",
      settings: { command: "echo hello" },
      inputs: { in: "data" },
      flowId: "flow-1",
      signal: new AbortController().signal,
    };

    expect(context.nodeId).toBe("node-1");
    expect(context.settings).toEqual({ command: "echo hello" });
    expect(context.inputs).toEqual({ in: "data" });
    expect(context.flowId).toBe("flow-1");
    expect(context.signal).toBeInstanceOf(AbortSignal);
  });

  // BDIT-03-002003-00002
  it("executionContext_usedByExecutor_producesResult", async () => {
    const executor: INodeExecutor = new TriggerExecutor();
    const context: IExecutionContext = {
      nodeId: "n1",
      settings: {},
      inputs: {},
      flowId: "f1",
      signal: new AbortController().signal,
    };

    const result = await executor.execute(context);
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
  });
});

// --- BD-03-002004: IExecutionResult ---

describe("IExecutionResult (BD-03-002004)", () => {
  // BDIT-03-002004-00001
  it("executionResult_hasRequiredFields", async () => {
    const executor: INodeExecutor = new TriggerExecutor();
    const context: IExecutionContext = {
      nodeId: "n1",
      settings: {},
      inputs: {},
      flowId: "f1",
      signal: new AbortController().signal,
    };

    const result: IExecutionResult = await executor.execute(context);

    expect(result.status).toBeDefined();
    expect(result.outputs).toBeDefined();
    expect(typeof result.duration).toBe("number");
    // error is optional
  });

  // BDIT-03-002004-00002
  it("executionStatus_isOneOfExpectedValues", async () => {
    const executor: INodeExecutor = new TriggerExecutor();
    const result = await executor.execute({
      nodeId: "n1",
      settings: {},
      inputs: {},
      flowId: "f1",
      signal: new AbortController().signal,
    });

    const validStatuses = ["success", "error", "skipped", "cancelled"];
    expect(validStatuses).toContain(result.status);
  });
});

// --- BD-03-002005: ValidationResult ---

describe("ValidationResult (BD-03-002005)", () => {
  // BDIT-03-002005-00001
  it("validationResult_validCase_hasValidTrue", () => {
    const executor: INodeExecutor = new CommandExecutor();
    const result: ValidationResult = executor.validate({ command: "echo test" });

    expect(result.valid).toBe(true);
  });

  // BDIT-03-002005-00002
  it("validationResult_invalidCase_hasValidFalseAndErrors", () => {
    const executor: INodeExecutor = new CommandExecutor();
    const result: ValidationResult = executor.validate({});

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);

    const error: ValidationError = result.errors![0];
    expect(typeof error.field).toBe("string");
    expect(typeof error.message).toBe("string");
  });
});
