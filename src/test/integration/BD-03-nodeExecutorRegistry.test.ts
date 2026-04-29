// BD-03 INodeExecutorRegistry IT tests
// Trace: BD-03-003002 INodeExecutorRegistry インターフェース

import { describe, it, expect } from "vitest";
import { NodeExecutorRegistry } from "@extension/registries/NodeExecutorRegistry.js";
import { MockNodeExecutor } from "@extension/mocks/MockNodeExecutor.js";

function createNodeExecutorRegistry(): NodeExecutorRegistry {
  return new NodeExecutorRegistry();
}

function createStubNodeExecutor(nodeType: string): MockNodeExecutor {
  return new MockNodeExecutor(nodeType);
}

describe("INodeExecutorRegistry", () => {
  // BDIT-03-003002-00001
  it("register_withNewNodeType_succeedsWithoutError", () => {
    const registry = createNodeExecutorRegistry();
    const executor = createStubNodeExecutor("command");

    expect(() => registry.register("command", executor)).not.toThrow();
  });

  // BDIT-03-003002-00002
  it("get_withRegisteredType_returnsExecutor", () => {
    const registry = createNodeExecutorRegistry();
    const executor = createStubNodeExecutor("command");

    registry.register("command", executor);
    const retrieved = registry.get("command");

    expect(retrieved).toBe(executor);
  });

  // BDIT-03-003002-00003
  it("has_withRegisteredType_returnsTrue", () => {
    const registry = createNodeExecutorRegistry();
    const executor = createStubNodeExecutor("command");

    registry.register("command", executor);

    expect(registry.has("command")).toBe(true);
  });

  // BDIT-03-003002-00004
  it("has_withUnregisteredType_returnsFalse", () => {
    const registry = createNodeExecutorRegistry();

    expect(registry.has("unknown")).toBe(false);
  });

  // BDIT-03-003002-00005
  it("getAll_withRegisteredExecutors_returnsAll", () => {
    const registry = createNodeExecutorRegistry();
    const executor1 = createStubNodeExecutor("command");
    const executor2 = createStubNodeExecutor("log");

    registry.register("command", executor1);
    registry.register("log", executor2);

    const all = registry.getAll();

    expect(all.length).toBe(2);
  });
});
