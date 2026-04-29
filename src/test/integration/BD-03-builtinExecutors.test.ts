// BD-03 ビルトインノード Executor IT tests
// Trace: BD-03-006001 TriggerExecutor, BD-03-006002 CommandExecutor,
//        BD-03-006003 AIPromptExecutor, BD-03-006004 ConditionExecutor,
//        BD-03-006005 LoopExecutor, BD-03-006006 LogExecutor,
//        BD-03-006007 FileExecutor, BD-03-006008 HttpExecutor,
//        BD-03-006009 TransformExecutor, BD-03-006010 CommentExecutor,
//        BD-03-006011 SubFlowExecutor

import { describe, it, expect, vi } from "vitest";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";

import { TriggerExecutor } from "@extension/executors/TriggerExecutor.js";
import { CommandExecutor } from "@extension/executors/CommandExecutor.js";
import { AIPromptExecutor } from "@extension/executors/AIPromptExecutor.js";
import { ConditionExecutor } from "@extension/executors/ConditionExecutor.js";
import { LoopExecutor } from "@extension/executors/LoopExecutor.js";
import { LogExecutor } from "@extension/executors/LogExecutor.js";
import { FileExecutor } from "@extension/executors/FileExecutor.js";
import { HttpExecutor } from "@extension/executors/HttpExecutor.js";
import { TransformExecutor } from "@extension/executors/TransformExecutor.js";
import { CommentExecutor } from "@extension/executors/CommentExecutor.js";
import { SubFlowExecutor } from "@extension/executors/SubFlowExecutor.js";

function createContext(settings: Record<string, unknown> = {}, inputs: Record<string, unknown> = {}): IExecutionContext {
  return {
    nodeId: "n1",
    settings,
    inputs,
    flowId: "f1",
    signal: new AbortController().signal,
  };
}

function createMockOutputChannel() {
  return {
    appendLine: vi.fn(),
    append: vi.fn(),
    name: "test",
    clear: vi.fn(),
    dispose: vi.fn(),
    hide: vi.fn(),
    replace: vi.fn(),
    show: vi.fn(),
  } as unknown as import("vscode").OutputChannel;
}

// --- BD-03-006001: TriggerExecutor ---

describe("TriggerExecutor (BD-03-006001)", () => {
  // BDIT-03-006001-00001
  it("metadata_nodeTypeIsTrigger_categoryBasic", () => {
    const executor = new TriggerExecutor();
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("trigger");
    expect(meta.category).toBe("基本");
    expect(meta.inputPorts).toHaveLength(0);
    expect(meta.outputPorts.length).toBeGreaterThan(0);
  });

  // BDIT-03-006001-00002
  it("execute_returnsSuccess_outputsEmptyObject", async () => {
    const executor = new TriggerExecutor();
    const result = await executor.execute(createContext());

    expect(result.status).toBe("success");
    expect(result.outputs).toBeDefined();
  });
});

// --- BD-03-006002: CommandExecutor ---

describe("CommandExecutor (BD-03-006002)", () => {
  // BDIT-03-006002-00001
  it("metadata_nodeTypeIsCommand_hasTwoOutputPorts", () => {
    const executor = new CommandExecutor();
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("command");
    expect(meta.category).toBe("基本");
    expect(meta.inputPorts).toHaveLength(1);
    expect(meta.outputPorts).toHaveLength(2);

    const portIds = meta.outputPorts.map((p) => p.id);
    expect(portIds).toContain("stdout");
    expect(portIds).toContain("stderr");
  });

  // BDIT-03-006002-00002
  it("validate_withoutCommand_returnsInvalid", () => {
    const executor = new CommandExecutor();
    const result = executor.validate({});

    expect(result.valid).toBe(false);
  });

  // BDIT-03-006002-00003
  it("execute_echoCommand_returnsStdout", async () => {
    const executor = new CommandExecutor();
    const result = await executor.execute(createContext({ command: "echo hello" }));

    expect(result.status).toBe("success");
    expect(typeof result.outputs.stdout).toBe("string");
    expect((result.outputs.stdout as string).trim()).toBe("hello");
  });
});

// --- BD-03-006003: AIPromptExecutor ---

describe("AIPromptExecutor (BD-03-006003)", () => {
  // BDIT-03-006003-00001
  it("metadata_nodeTypeIsAiPrompt_categoryAI", () => {
    const executor = new AIPromptExecutor();
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("aiPrompt");
    expect(meta.category).toBe("AI");
    expect(meta.inputPorts).toHaveLength(1);
    expect(meta.outputPorts).toHaveLength(2);
  });

  // BDIT-03-006003-00002
  it("validate_withoutPrompt_returnsInvalid", () => {
    const executor = new AIPromptExecutor();
    const result = executor.validate({});

    expect(result.valid).toBe(false);
  });
});

// --- BD-03-006004: ConditionExecutor ---

describe("ConditionExecutor (BD-03-006004)", () => {
  // BDIT-03-006004-00001
  it("metadata_nodeTypeIsCondition_hasTrueFalseOutputs", () => {
    const executor = new ConditionExecutor();
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("condition");
    expect(meta.category).toBe("制御");
    const portIds = meta.outputPorts.map((p) => p.id);
    expect(portIds).toContain("true");
    expect(portIds).toContain("false");
  });

  // BDIT-03-006004-00002
  it("execute_truthyExpression_outputsToTruePort", async () => {
    const executor = new ConditionExecutor();
    const result = await executor.execute(
      createContext({ expression: "true" }, { in: "data" }),
    );

    expect(result.status).toBe("success");
    expect(result.outputs.true).toBeDefined();
  });
});

// --- BD-03-006005: LoopExecutor ---

describe("LoopExecutor (BD-03-006005)", () => {
  // BDIT-03-006005-00001
  it("metadata_nodeTypeIsLoop_hasBodyAndDoneOutputs", () => {
    const executor = new LoopExecutor();
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("loop");
    expect(meta.category).toBe("制御");
    const portIds = meta.outputPorts.map((p) => p.id);
    expect(portIds).toContain("body");
    expect(portIds).toContain("done");
  });

  // BDIT-03-006005-00002
  it("validate_withValidLoopType_returnsValid", () => {
    const executor = new LoopExecutor();
    const result = executor.validate({ loopType: "count", count: 3 });

    expect(result.valid).toBe(true);
  });
});

// --- BD-03-006006: LogExecutor ---

describe("LogExecutor (BD-03-006006)", () => {
  // BDIT-03-006006-00001
  it("metadata_nodeTypeIsLog_categoryBasic", () => {
    const ch = createMockOutputChannel();
    const executor = new LogExecutor(ch);
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("log");
    expect(meta.category).toBe("基本");
    expect(meta.inputPorts).toHaveLength(1);
    expect(meta.outputPorts).toHaveLength(1);
  });

  // BDIT-03-006006-00002
  it("execute_passesInputThrough_outputsToOutPort", async () => {
    const ch = createMockOutputChannel();
    const executor = new LogExecutor(ch);
    const result = await executor.execute(
      createContext({ message: "test {{input}}" }, { in: "hello" }),
    );

    expect(result.status).toBe("success");
    expect(result.outputs.out).toBeDefined();
  });
});

// --- BD-03-006007: FileExecutor ---

describe("FileExecutor (BD-03-006007)", () => {
  // BDIT-03-006007-00001
  it("metadata_nodeTypeIsFile_categoryData", () => {
    const executor = new FileExecutor();
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("file");
    expect(meta.category).toBe("データ");
  });

  // BDIT-03-006007-00002
  it("validate_withoutPath_returnsInvalid", () => {
    const executor = new FileExecutor();
    const result = executor.validate({ operation: "read" });

    expect(result.valid).toBe(false);
  });
});

// --- BD-03-006008: HttpExecutor ---

describe("HttpExecutor (BD-03-006008)", () => {
  // BDIT-03-006008-00001
  it("metadata_nodeTypeIsHttp_hasTwoOutputPorts", () => {
    const executor = new HttpExecutor();
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("http");
    expect(meta.category).toBe("データ");
    const portIds = meta.outputPorts.map((p) => p.id);
    expect(portIds).toContain("body");
    expect(portIds).toContain("status");
  });

  // BDIT-03-006008-00002
  it("validate_withoutUrl_returnsInvalid", () => {
    const executor = new HttpExecutor();
    const result = executor.validate({});

    expect(result.valid).toBe(false);
  });
});

// --- BD-03-006009: TransformExecutor ---

describe("TransformExecutor (BD-03-006009)", () => {
  // BDIT-03-006009-00001
  it("metadata_nodeTypeIsTransform_categoryData", () => {
    const executor = new TransformExecutor();
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("transform");
    expect(meta.category).toBe("データ");
  });

  // BDIT-03-006009-00002
  it("execute_expression_transformsInput", async () => {
    const executor = new TransformExecutor();
    const result = await executor.execute(
      createContext({ transformType: "jsExpression", expression: "input * 2" }, { in: 21 }),
    );

    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe(42);
  });
});

// --- BD-03-006010: CommentExecutor ---

describe("CommentExecutor (BD-03-006010)", () => {
  // BDIT-03-006010-00001
  it("metadata_nodeTypeIsComment_noPortsExceptSettings", () => {
    const executor = new CommentExecutor();
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("comment");
    expect(meta.category).toBe("その他");
    expect(meta.inputPorts).toHaveLength(0);
    expect(meta.outputPorts).toHaveLength(0);
  });

  // BDIT-03-006010-00002
  it("execute_returnsSkipped", async () => {
    const executor = new CommentExecutor();
    const result = await executor.execute(createContext());

    expect(result.status).toBe("skipped");
  });
});

// --- BD-03-006011: SubFlowExecutor ---

describe("SubFlowExecutor (BD-03-006011)", () => {
  // BDIT-03-006011-00001
  it("metadata_nodeTypeIsSubFlow_categoryControl", () => {
    const mockRepo = {} as import("@extension/interfaces/IFlowRepository.js").IFlowRepository;
    const mockExec = {} as import("@extension/interfaces/IExecutionService.js").IExecutionService;
    const executor = new SubFlowExecutor(mockRepo, mockExec);
    const meta = executor.getMetadata();

    expect(meta.nodeType).toBe("subFlow");
    expect(meta.category).toBe("制御");
    expect(meta.inputPorts).toHaveLength(1);
    expect(meta.outputPorts).toHaveLength(1);
  });

  // BDIT-03-006011-00002
  it("validate_withoutFlowId_returnsInvalid", () => {
    const mockRepo = {} as import("@extension/interfaces/IFlowRepository.js").IFlowRepository;
    const mockExec = {} as import("@extension/interfaces/IExecutionService.js").IExecutionService;
    const executor = new SubFlowExecutor(mockRepo, mockExec);
    const result = executor.validate({});

    expect(result.valid).toBe(false);
  });
});
