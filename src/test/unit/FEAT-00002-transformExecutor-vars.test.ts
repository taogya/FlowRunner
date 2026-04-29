/**
 * FEAT-00002: TransformExecutor setVar/getVar unit tests + integration tests
 *
 * Tests for shared variable store operations via TransformExecutor,
 * IExecutionContext backward compatibility, and service-level variable sharing.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TransformExecutor } from "@extension/executors/TransformExecutor.js";
import { VariableStore } from "@extension/interfaces/IVariableStore.js";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";
import type { IVariableStore } from "@extension/interfaces/IVariableStore.js";

function makeContext(
  overrides: Partial<IExecutionContext> & Pick<IExecutionContext, "settings">,
): IExecutionContext {
  return {
    nodeId: "test-node",
    inputs: {},
    flowId: "flow-1",
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("TransformExecutor - setVar / getVar (FEAT-00002)", () => {
  let executor: TransformExecutor;
  let variables: IVariableStore;

  beforeEach(() => {
    executor = new TransformExecutor();
    variables = new VariableStore();
  });

  // FEAT-00002-003005-00001: setVar で変数を設定しパススルーする
  it("setVar should store value and pass through input", async () => {
    const ctx = makeContext({
      settings: { transformType: "setVar", varName: "myVar" },
      inputs: { in: "hello" },
      variables,
    });
    const result = await executor.execute(ctx);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("hello");
    expect(variables.get("myVar")).toBe("hello");
  });

  it("setVar should store object values", async () => {
    const obj = { count: 42 };
    const ctx = makeContext({
      settings: { transformType: "setVar", varName: "data" },
      inputs: { in: obj },
      variables,
    });
    const result = await executor.execute(ctx);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe(obj);
    expect(variables.get("data")).toBe(obj);
  });

  // FEAT-00002-003005-00002: getVar で変数を取得する
  it("getVar should retrieve stored variable", async () => {
    variables.set("myVar", "world");
    const ctx = makeContext({
      settings: { transformType: "getVar", varName: "myVar" },
      variables,
    });
    const result = await executor.execute(ctx);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("world");
  });

  // FEAT-00002-003005-00003: getVar で未定義変数に defaultValue を返す
  it("getVar should return defaultValue when variable is not set", async () => {
    const ctx = makeContext({
      settings: { transformType: "getVar", varName: "missing", defaultValue: "fallback" },
      variables,
    });
    const result = await executor.execute(ctx);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("fallback");
  });

  it("getVar should return undefined when variable is not set and no defaultValue", async () => {
    const ctx = makeContext({
      settings: { transformType: "getVar", varName: "missing" },
      variables,
    });
    const result = await executor.execute(ctx);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBeUndefined();
  });

  // FEAT-00002-003005-00004: variables 未設定時に setVar/getVar がエラーにならない
  it("setVar should not throw when variables is undefined", async () => {
    const ctx = makeContext({
      settings: { transformType: "setVar", varName: "x" },
      inputs: { in: 123 },
      // no variables
    });
    const result = await executor.execute(ctx);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe(123);
  });

  it("getVar should return defaultValue when variables is undefined", async () => {
    const ctx = makeContext({
      settings: { transformType: "getVar", varName: "x", defaultValue: "def" },
      // no variables
    });
    const result = await executor.execute(ctx);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("def");
  });

  // Validation tests
  describe("validation", () => {
    it("should require varName for setVar", () => {
      const result = executor.validate({ transformType: "setVar" });
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]?.field).toBe("varName");
    });

    it("should require varName for getVar", () => {
      const result = executor.validate({ transformType: "getVar" });
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]?.field).toBe("varName");
    });

    it("should pass validation when varName is set for setVar", () => {
      const result = executor.validate({ transformType: "setVar", varName: "x" });
      expect(result.valid).toBe(true);
    });

    it("should pass validation when varName is set for getVar", () => {
      const result = executor.validate({ transformType: "getVar", varName: "x" });
      expect(result.valid).toBe(true);
    });

    it("settingsSchema should include setVar and getVar options", () => {
      const meta = executor.getMetadata();
      const transformField = meta.settingsSchema.find((f) => f.key === "transformType");
      const optionValues = transformField?.options?.map((o) => o.value) ?? [];
      expect(optionValues).toContain("setVar");
      expect(optionValues).toContain("getVar");
    });

    it("settingsSchema should include varName and defaultValue fields", () => {
      const meta = executor.getMetadata();
      const keys = meta.settingsSchema.map((f) => f.key);
      expect(keys).toContain("varName");
      expect(keys).toContain("defaultValue");
    });
  });
});

// FEAT-00002-003002-00001: variables 未設定でも既存動作に影響しない
describe("IExecutionContext backward compatibility (FEAT-00002)", () => {
  it("existing transform types work without variables field", async () => {
    const executor = new TransformExecutor();
    const ctx = makeContext({
      settings: { transformType: "jsonParse" },
      inputs: { in: '{"a":1}' },
      // no variables field
    });
    const result = await executor.execute(ctx);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toEqual({ a: 1 });
  });
});
