// DD-03 AIPromptExecutor UT tests
// Trace: DD-03-006001

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIPromptExecutor } from "@extension/executors/AIPromptExecutor.js";
import * as vscode from "vscode";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";

function makeContext(overrides?: Partial<IExecutionContext>): IExecutionContext {
  return {
    nodeId: "n1",
    flowId: "f1",
    settings: { prompt: "Hello {{input}}", model: "test-model" },
    inputs: { in: "world" },
    signal: new AbortController().signal,
    ...overrides,
  };
}

function mockModel(responseText: string) {
  const textFragments = [responseText];
  return {
    id: "test-model",
    name: "Test Model",
    family: "test",
    maxInputTokens: 4000,
    sendRequest: vi.fn().mockResolvedValue({
      text: textFragments,
    }),
    countTokens: vi.fn().mockResolvedValue(10),
  };
}

describe("AIPromptExecutor", () => {
  // DDUT-03-006001-00001
  it("validate_emptyPrompt_returnsInvalid", () => {
    // Arrange
    const executor = new AIPromptExecutor();

    // Act
    const result = executor.validate({ prompt: "" });

    // Assert
    expect(result.valid).toBe(false);
  });

  // DDUT-03-006001-00002
  it("validate_noModel_returnsInvalid", () => {
    // Arrange
    const executor = new AIPromptExecutor();

    // Act
    const result = executor.validate({ prompt: "Hello", model: "" });

    // Assert
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]?.field).toBe("model");
  });

  // DDUT-03-006001-00003
  it("validate_withModel_returnsValid", () => {
    // Arrange
    const executor = new AIPromptExecutor();

    // Act
    const result = executor.validate({ prompt: "Hello", model: "gpt-4o" });

    // Assert
    expect(result.valid).toBe(true);
  });

  // --- execute tests ---

  // DDUT-03-006001-00004
  it("execute_noModel_returnsError", async () => {
    const executor = new AIPromptExecutor();
    const ctx = makeContext({ settings: { prompt: "test", model: "" } });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("モデル");
  });

  // DDUT-03-006001-00005
  it("execute_noAvailableModel_returnsError", async () => {
    const executor = new AIPromptExecutor();
    (vscode.lm.selectChatModels as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const ctx = makeContext();

    const result = await executor.execute(ctx);

    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("No language model");
  });

  // DDUT-03-006001-00006
  it("execute_success_returnsResponseText", async () => {
    const executor = new AIPromptExecutor();
    const model = mockModel("AI response");
    (vscode.lm.selectChatModels as ReturnType<typeof vi.fn>).mockResolvedValueOnce([model]);
    const ctx = makeContext();

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("AI response");
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  // DDUT-03-006001-00007
  it("execute_success_includesTokenUsage", async () => {
    const executor = new AIPromptExecutor();
    const model = mockModel("response");
    (vscode.lm.selectChatModels as ReturnType<typeof vi.fn>).mockResolvedValueOnce([model]);
    const ctx = makeContext();

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs._tokenUsage).toBeDefined();
    expect(result.outputs._tokenUsage.model).toBe("test-model");
    expect(result.outputs._tokenUsage.totalTokens).toBe(20); // 10 + 10
  });

  // DDUT-03-006001-00008
  it("execute_templateExpansion_expandsInputInPrompt", async () => {
    const executor = new AIPromptExecutor();
    const model = mockModel("ok");
    (vscode.lm.selectChatModels as ReturnType<typeof vi.fn>).mockResolvedValueOnce([model]);
    const ctx = makeContext({ inputs: { in: "world" } });

    await executor.execute(ctx);

    // sendRequest should receive expanded prompt containing "world"
    const sentMessages = model.sendRequest.mock.calls[0][0];
    expect(sentMessages[0].content).toContain("world");
  });

  // DDUT-03-006001-00009
  it("execute_abortedSignal_returnsCancelled", async () => {
    const executor = new AIPromptExecutor();
    const ac = new AbortController();
    ac.abort();
    const ctx = makeContext({ signal: ac.signal });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("cancelled");
  });

  // DDUT-03-006001-00010
  it("execute_sendRequestThrows_returnsError", async () => {
    const executor = new AIPromptExecutor();
    const model = mockModel("");
    model.sendRequest.mockRejectedValueOnce(new Error("API error"));
    (vscode.lm.selectChatModels as ReturnType<typeof vi.fn>).mockResolvedValueOnce([model]);
    const ctx = makeContext();

    const result = await executor.execute(ctx);

    expect(result.status).toBe("error");
    expect(result.error?.message).toBe("API error");
  });

  // DDUT-03-006001-00011
  it("execute_autoAppendInput_whenNoTemplate", async () => {
    const executor = new AIPromptExecutor();
    const model = mockModel("ok");
    (vscode.lm.selectChatModels as ReturnType<typeof vi.fn>).mockResolvedValueOnce([model]);
    // Prompt without {{input}} template → input auto-prepended
    const ctx = makeContext({
      settings: { prompt: "Summarize this", model: "test-model" },
      inputs: { in: "long text" },
    });

    await executor.execute(ctx);

    const sentMessages = model.sendRequest.mock.calls[0][0];
    expect(sentMessages[0].content).toContain("long text");
    expect(sentMessages[0].content).toContain("Summarize this");
  });

  // DDUT-03-006001-00012
  it("execute_countTokensFails_stillReturnsSuccess", async () => {
    const executor = new AIPromptExecutor();
    const model = mockModel("response");
    model.countTokens.mockRejectedValue(new Error("not supported"));
    (vscode.lm.selectChatModels as ReturnType<typeof vi.fn>).mockResolvedValueOnce([model]);
    const ctx = makeContext();

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("response");
    // _tokenUsage should not be present when countTokens fails
    expect(result.outputs._tokenUsage).toBeUndefined();
  });
});
