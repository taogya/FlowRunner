// DD-03 CommentExecutor UT tests
// Trace: DD-03-009001

import { describe, it, expect } from "vitest";
import { CommentExecutor } from "@extension/executors/CommentExecutor.js";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";

function createContext(overrides: Partial<IExecutionContext> = {}): IExecutionContext {
  return {
    nodeId: "n1",
    settings: {},
    inputs: {},
    flowId: "flow-1",
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("CommentExecutor", () => {
  // DDUT-03-009001-00001
  it("validate_alwaysReturnsValid", () => {
    // Arrange
    const executor = new CommentExecutor();

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(true);
  });

  // DDUT-03-009001-00002
  it("execute_skipped_returnsSkipped", async () => {
    // Arrange
    const executor = new CommentExecutor();
    const context = createContext();

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("skipped");
  });
});
