// BD-03 NodeExecutorRegistry 初期化・登録フロー IT tests
// Trace: BD-03-003001 NodeExecutorRegistry 概要,
//        BD-03-003003 初期化と登録フロー

import { describe, it, expect, vi } from "vitest";
import { NodeExecutorRegistry } from "@extension/registries/NodeExecutorRegistry.js";
import {
  registerBuiltinExecutors,
} from "@extension/registries/registerBuiltinExecutors.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import { MockNodeExecutor } from "@extension/mocks/MockNodeExecutor.js";

// --- BD-03-003001: NodeExecutorRegistry 概要 ---

describe("NodeExecutorRegistry Overview (BD-03-003001)", () => {
  // BDIT-03-003001-00001
  it("registry_implementsINodeExecutorRegistry", () => {
    const registry: INodeExecutorRegistry = new NodeExecutorRegistry();

    expect(typeof registry.register).toBe("function");
    expect(typeof registry.get).toBe("function");
    expect(typeof registry.getAll).toBe("function");
    expect(typeof registry.has).toBe("function");
  });

  // BDIT-03-003001-00002
  it("registry_managesExecutorsByNodeType", () => {
    const registry = new NodeExecutorRegistry();
    const executor = new MockNodeExecutor("command");

    registry.register("command", executor);

    expect(registry.has("command")).toBe(true);
    expect(registry.get("command")).toBe(executor);
  });

  // BDIT-03-003001-00003
  it("register_duplicateNodeType_throwsError", () => {
    const registry = new NodeExecutorRegistry();
    const executor1 = new MockNodeExecutor("command");
    const executor2 = new MockNodeExecutor("command");

    registry.register("command", executor1);
    expect(() => registry.register("command", executor2)).toThrow();
  });

  // BDIT-03-003001-00004
  it("get_unregisteredType_throwsError", () => {
    const registry = new NodeExecutorRegistry();

    expect(() => registry.get("unknown")).toThrow();
  });
});

// --- BD-03-003003: 初期化と登録フロー ---

describe("Registration Flow (BD-03-003003)", () => {
  // BDIT-03-003003-00001
  it("registerBuiltinExecutors_registers12Types", () => {
    const registry = new NodeExecutorRegistry();
    const deps = {
      outputChannel: {
        appendLine: vi.fn(),
        append: vi.fn(),
        name: "test",
        clear: vi.fn(),
        dispose: vi.fn(),
        hide: vi.fn(),
        replace: vi.fn(),
        show: vi.fn(),
      } as unknown as import("vscode").OutputChannel,
      flowRepository: {} as import("@extension/interfaces/IFlowRepository.js").IFlowRepository,
      executionService: {} as import("@extension/interfaces/IExecutionService.js").IExecutionService,
    };

    registerBuiltinExecutors(registry, deps);

    const expectedTypes = [
      "trigger", "command", "log", "aiPrompt", "condition",
      "loop", "subFlow", "file", "http", "transform", "comment", "tryCatch", "parallel",
    ];

    for (const nodeType of expectedTypes) {
      expect(registry.has(nodeType)).toBe(true);
    }
    expect(registry.getAll()).toHaveLength(13);
  });

  // BDIT-03-003003-00002
  it("registeredExecutors_eachHasValidMetadata", () => {
    const registry = new NodeExecutorRegistry();
    const deps = {
      outputChannel: {
        appendLine: vi.fn(),
        append: vi.fn(),
        name: "test",
        clear: vi.fn(),
        dispose: vi.fn(),
        hide: vi.fn(),
        replace: vi.fn(),
        show: vi.fn(),
      } as unknown as import("vscode").OutputChannel,
      flowRepository: {} as import("@extension/interfaces/IFlowRepository.js").IFlowRepository,
      executionService: {} as import("@extension/interfaces/IExecutionService.js").IExecutionService,
    };

    registerBuiltinExecutors(registry, deps);

    const all = registry.getAll();
    for (const executor of all) {
      const meta = executor.getMetadata();
      expect(meta.nodeType).toBeDefined();
      expect(meta.label).toBeDefined();
      expect(meta.category).toBeDefined();
      expect(Array.isArray(meta.inputPorts)).toBe(true);
      expect(Array.isArray(meta.outputPorts)).toBe(true);
      expect(Array.isArray(meta.settingsSchema)).toBe(true);
    }
  });
});
