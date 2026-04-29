// DD-03 Basic Executors UT tests (Trigger / Command / Log)
// Trace: DD-03-004001, DD-03-005001, DD-03-005002, DD-03-005003

import { describe, it, expect, vi } from "vitest";
import { TriggerExecutor } from "@extension/executors/TriggerExecutor.js";
import { CommandExecutor } from "@extension/executors/CommandExecutor.js";
import { LogExecutor } from "@extension/executors/LogExecutor.js";
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

// ============================
// TriggerExecutor
// ============================
describe("TriggerExecutor", () => {
  // DDUT-03-005001-00001
  it("validate_alwaysReturnsValid", () => {
    // Arrange
    const executor = new TriggerExecutor();

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(true);
  });

  // DDUT-03-005001-00002
  it("execute_returnsEmptyOutput", async () => {
    // Arrange
    const executor = new TriggerExecutor();
    const context = createContext();

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
  });
});

// ============================
// CommandExecutor
// ============================
describe("CommandExecutor", () => {
  // DDUT-03-005002-00001
  it("validate_noCommand_returnsInvalid", () => {
    // Arrange
    const executor = new CommandExecutor();

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(false);
  });

  // DDUT-03-005002-00002
  it("execute_exitZero_returnsSuccess", async () => {
    // Arrange
    const executor = new CommandExecutor();
    const context = createContext({
      settings: { command: 'echo "hello"' },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
  });

  // DDUT-03-005002-00003
  it("execute_nonZeroExit_returnsError", async () => {
    // Arrange
    const executor = new CommandExecutor();
    const context = createContext({
      settings: { command: "exit 1" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("error");
  });

  // DDUT-03-005002-00004
  it("execute_capturesStdout", async () => {
    const executor = new CommandExecutor();
    const context = createContext({
      settings: { command: 'echo "captured"' },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.stdout).toContain("captured");
  });

  // DDUT-03-005002-00005
  it("execute_capturesStderr", async () => {
    const executor = new CommandExecutor();
    const context = createContext({
      settings: { command: 'echo "errout" >&2' },
    });
    const result = await executor.execute(context);
    expect(result.outputs.stderr).toContain("errout");
  });

  // DDUT-03-005002-00006
  it("execute_abortedSignal_returnsCancelled", async () => {
    const executor = new CommandExecutor();
    const ac = new AbortController();
    ac.abort();
    const context = createContext({
      settings: { command: "echo nope" },
      signal: ac.signal,
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("cancelled");
  });

  // DDUT-03-005002-00007
  it("execute_timeout_returnsError", async () => {
    const executor = new CommandExecutor();
    const context = createContext({
      settings: { command: "sleep 10", timeout: 1 },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("timed out");
  }, 10000);

  // DDUT-03-005002-00008
  it("execute_templateExpansion_expandsInput", async () => {
    const executor = new CommandExecutor();
    const context = createContext({
      settings: { command: "echo {{input}}" },
      inputs: { in: "expanded_value" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.stdout).toContain("expanded_value");
  });

  // DDUT-03-005002-00009
  it("execute_customEnv_passesEnvironment", async () => {
    const executor = new CommandExecutor();
    const context = createContext({
      settings: { command: "echo $MY_VAR", env: { MY_VAR: "test_env_val" } },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.stdout).toContain("test_env_val");
  });

  // DDUT-03-005002-00010
  it("execute_customCwd_changesDirectory", async () => {
    const executor = new CommandExecutor();
    const context = createContext({
      settings: { command: "pwd", cwd: "/tmp" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    // /tmp may resolve to /private/tmp on macOS
    expect(result.outputs.stdout).toMatch(/\/tmp/);
  });

  // DDUT-03-005002-00011
  it("execute_outputChannelReceivesStdout", async () => {
    const oc = { appendLine: vi.fn() };
    const executor = new CommandExecutor(oc);
    const context = createContext({
      settings: { command: 'echo "logged"' },
      nodeLabel: "package",
    });
    await executor.execute(context);
    const calls = oc.appendLine.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((m: string) => m.includes("logged"))).toBe(true);
    expect(calls.some((m: string) => m.includes("(package)"))).toBe(true);
  });

  // DDUT-03-005002-00012
  it("execute_shellBash_executesWithBash", async () => {
    const executor = new CommandExecutor();
    const context = createContext({
      settings: { command: 'echo "$BASH_VERSION"', shell: "bash" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    // bash should have a version string
    expect(result.outputs.stdout!.length).toBeGreaterThan(0);
  });
});

// ============================
// LogExecutor
// ============================

function createMockOutputChannel() {
  return {
    appendLine: vi.fn(),
    append: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("LogExecutor", () => {
  // DDUT-03-005003-00001
  it("validate_alwaysReturnsValid", () => {
    // Arrange
    const outputChannel = createMockOutputChannel();
    const executor = new LogExecutor(outputChannel as any);

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(true);
  });

  // DDUT-03-005003-00002
  it("execute_infoLevel_logsToOutputChannel", async () => {
    // Arrange
    const outputChannel = createMockOutputChannel();
    const executor = new LogExecutor(outputChannel as any);
    const context = createContext({
      settings: { level: "info", message: "test message" },
      nodeLabel: "package",
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
    expect(outputChannel.appendLine).toHaveBeenCalledWith("[INFO] (package) test message");
  });

  // DDUT-03-005003-00003
  it("execute_passesInputToOutput", async () => {
    // Arrange
    const outputChannel = createMockOutputChannel();
    const executor = new LogExecutor(outputChannel as any);
    const context = createContext({
      settings: { level: "info", message: "{{input}}" },
      inputs: { in: "data" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
    expect(result.outputs?.out).toBe("data");
  });

  // DDUT-03-005003-00004
  it("execute_warnLevel_logsWithWarnPrefix", async () => {
    // Arrange
    const outputChannel = createMockOutputChannel();
    const executor = new LogExecutor(outputChannel as any);
    const context = createContext({
      settings: { level: "warn", message: "warning msg" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
    expect(outputChannel.appendLine).toHaveBeenCalledWith("[WARN] (n1) warning msg");
  });

  // DDUT-03-005003-00005
  it("execute_errorLevel_logsWithErrorPrefix", async () => {
    // Arrange
    const outputChannel = createMockOutputChannel();
    const executor = new LogExecutor(outputChannel as any);
    const context = createContext({
      settings: { level: "error", message: "error msg" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
    expect(outputChannel.appendLine).toHaveBeenCalledWith("[ERROR] (n1) error msg");
  });

  // DDUT-03-005003-00006
  it("execute_defaultLevel_usesInfo", async () => {
    // Arrange
    const outputChannel = createMockOutputChannel();
    const executor = new LogExecutor(outputChannel as any);
    const context = createContext({
      settings: { message: "default level" },
    });

    // Act
    const _result = await executor.execute(context);

    // Assert
    expect(outputChannel.appendLine).toHaveBeenCalledWith("[INFO] (n1) default level");
  });

  // DDUT-03-005003-00007
  it("execute_defaultMessage_usesInputTemplate", async () => {
    // Arrange
    const outputChannel = createMockOutputChannel();
    const executor = new LogExecutor(outputChannel as any);
    const context = createContext({
      settings: {},
      inputs: { in: "hello" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(outputChannel.appendLine).toHaveBeenCalledWith("[INFO] (n1) hello");
    expect(result.outputs?.out).toBe("hello");
  });
});

// --- DD-03-004001: ビルトイン Executor 共通実装パターン ---

describe("Executor Common Pattern", () => {
  // DDUT-03-004001-00001
  it("allExecutors_implementINodeExecutor", () => {
    // Arrange
    const trigger = new TriggerExecutor();
    const command = new CommandExecutor();
    const outputChannel = createMockOutputChannel();
    const log = new LogExecutor(outputChannel as any);

    // Assert — all have getMetadata, validate, execute
    for (const exec of [trigger, command, log]) {
      expect(typeof exec.getMetadata).toBe("function");
      expect(typeof exec.validate).toBe("function");
      expect(typeof exec.execute).toBe("function");
    }
  });

  // DDUT-03-004001-00002
  it("getMetadata_returnsINodeTypeMetadata", () => {
    // Arrange
    const trigger = new TriggerExecutor();

    // Act
    const meta = trigger.getMetadata();

    // Assert
    expect(meta.nodeType).toBeDefined();
    expect(meta.label).toBeDefined();
    expect(meta.category).toBeDefined();
    expect(Array.isArray(meta.inputPorts)).toBe(true);
    expect(Array.isArray(meta.outputPorts)).toBe(true);
    expect(Array.isArray(meta.settingsSchema)).toBe(true);
  });
});
