// BD-03 INodeExecutor IT tests
// Trace: BD-03-002002 INodeExecutor メソッド定義
//
// Mock→Real スワップ済み。Real Executor が INodeExecutor インターフェースを
// 正しく実装していることを検証する。

import { describe, it, expect } from "vitest";
import type { INodeExecutor, IExecutionContext } from "@extension/interfaces/INodeExecutor.js";
import { CommandExecutor } from "@extension/executors/CommandExecutor.js";

function createRealExecutor(): INodeExecutor {
  return new CommandExecutor();
}

describe("INodeExecutor", () => {
  // BDIT-03-002002-00001
  it("execute_withValidContext_returnsResult", async () => {
    const executor = createRealExecutor();
    const context: IExecutionContext = {
      nodeId: "node-1",
      settings: { command: "echo hello" },
      inputs: { in: "test" },
      flowId: "flow-1",
      signal: new AbortController().signal,
    };

    const result = await executor.execute(context);

    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.outputs).toBeDefined();
    expect(typeof result.duration).toBe("number");
  });

  // BDIT-03-002002-00002
  it("validate_withValidSettings_returnsValid", () => {
    const executor = createRealExecutor();

    const result = executor.validate({ command: "echo hello" });

    expect(result.valid).toBe(true);
  });

  // BDIT-03-002002-00003
  it("validate_withInvalidSettings_returnsErrors", () => {
    const executor = createRealExecutor();

    const result = executor.validate({});

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  // BDIT-03-002002-00004
  it("getMetadata_called_returnsMetadata", () => {
    const executor = createRealExecutor();

    const metadata = executor.getMetadata();

    expect(metadata.nodeType).toBeDefined();
    expect(metadata.label).toBeDefined();
    expect(metadata.inputPorts).toBeDefined();
    expect(metadata.outputPorts).toBeDefined();
    expect(metadata.settingsSchema).toBeDefined();
  });
});
