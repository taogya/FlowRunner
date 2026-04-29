// DD-03 NodeExecutorRegistry UT tests
// Trace: DD-03-002001, DD-03-002002, DD-03-002003, DD-03-002004

import { describe, it, expect, vi } from "vitest";
import { NodeExecutorRegistry } from "@extension/registries/NodeExecutorRegistry.js";
import { registerBuiltinExecutors } from "@extension/registries/registerBuiltinExecutors.js";
import type { INodeExecutor } from "@extension/interfaces/INodeExecutor.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";

// --- Test helpers ---

function createStubExecutor(nodeType = "test"): INodeExecutor {
  return {
    execute: vi.fn().mockResolvedValue({ status: "success", outputs: {}, duration: 0 }),
    validate: vi.fn().mockReturnValue({ valid: true }),
    getMetadata: vi.fn().mockReturnValue({ nodeType, label: nodeType, icon: "", category: "basic", inputPorts: [], outputPorts: [], settingsSchema: [] }),
  };
}

describe("NodeExecutorRegistry", () => {
  // --- DD-03-002001: 概要 ---

  // DDUT-03-002001-00001
  it("canBeInstantiated", () => {
    // Act
    const registry = new NodeExecutorRegistry();

    // Assert
    expect(registry).toBeDefined();
    expect(registry).toBeInstanceOf(NodeExecutorRegistry);
  });

  // --- DD-03-002002: クラス設計 ---

  // DDUT-03-002002-00001
  it("implementsINodeExecutorRegistry", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();

    // Assert
    const iface: INodeExecutorRegistry = registry;
    expect(typeof iface.register).toBe("function");
    expect(typeof iface.get).toBe("function");
    expect(typeof iface.getAll).toBe("function");
    expect(typeof iface.has).toBe("function");
  });

  // DDUT-03-002003-00001
  it("register_newExecutor_succeeds", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();
    const executor = createStubExecutor("command");

    // Act & Assert
    expect(() => registry.register("command", executor)).not.toThrow();
  });

  // DDUT-03-002003-00002
  it("register_duplicateNodeType_throwsError", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();
    registry.register("command", createStubExecutor("command"));

    // Act & Assert
    expect(() => registry.register("command", createStubExecutor("command"))).toThrow(
      "Executor already registered for nodeType: command",
    );
  });

  // DDUT-03-002003-00003
  it("get_registeredType_returnsExecutor", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();
    const executor = createStubExecutor("command");
    registry.register("command", executor);

    // Act
    const result = registry.get("command");

    // Assert
    expect(result).toBe(executor);
  });

  // DDUT-03-002003-00004
  it("get_unregisteredType_throwsError", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();

    // Act & Assert
    expect(() => registry.get("unknown")).toThrow(
      "No executor registered for nodeType: unknown",
    );
  });

  // DDUT-03-002003-00005
  it("getAll_returnsAllExecutorsAsArray", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();
    registry.register("a", createStubExecutor("a"));
    registry.register("b", createStubExecutor("b"));

    // Act
    const result = registry.getAll();

    // Assert
    expect(result).toHaveLength(2);
  });

  // DDUT-03-002003-00006
  it("has_registeredType_returnsTrue", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();
    registry.register("command", createStubExecutor("command"));

    // Act & Assert
    expect(registry.has("command")).toBe(true);
  });

  // DDUT-03-002003-00007
  it("has_unregisteredType_returnsFalse", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();

    // Act & Assert
    expect(registry.has("unknown")).toBe(false);
  });
});

describe("registerBuiltinExecutors", () => {
  // DDUT-03-002004-00001
  it("registersAll11BuiltinTypes_withDeps", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();
    const deps = {
      outputChannel: { appendLine: vi.fn(), append: vi.fn(), show: vi.fn(), dispose: vi.fn() } as any,
      flowRepository: {} as any,
      executionService: {} as any,
    };

    // Act
    registerBuiltinExecutors(registry, deps);

    // Assert
    const expectedTypes = [
      "trigger", "command", "aiPrompt", "condition", "loop",
      "log", "file", "http", "transform", "comment", "subFlow",
    ];
    for (const type of expectedTypes) {
      expect(registry.has(type)).toBe(true);
    }
  });
});
