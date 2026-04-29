// DD-03 Data Executors UT tests (File / Http / Transform)
// Trace: DD-03-008001, DD-03-008002, DD-03-008003

import { describe, it, expect } from "vitest";
import { FileExecutor } from "@extension/executors/FileExecutor.js";
import { HttpExecutor } from "@extension/executors/HttpExecutor.js";
import { TransformExecutor } from "@extension/executors/TransformExecutor.js";
import { VariableStore } from "@extension/interfaces/IVariableStore.js";
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
// FileExecutor
// ============================
describe("FileExecutor", () => {
  // DDUT-03-008001-00001
  it("validate_noPath_returnsInvalid", () => {
    // Arrange
    const executor = new FileExecutor();

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(false);
  });

  // DDUT-03-008001-00002 — REV-012 #2: absolute path is now allowed
  it("validate_absolutePath_returnsValid", () => {
    // Arrange
    const executor = new FileExecutor();

    // Act
    const result = executor.validate({ path: "/etc/passwd", operation: "read" });

    // Assert
    expect(result.valid).toBe(true);
  });

  // DDUT-03-008001-00003
  it("validate_pathWithDotDot_returnsInvalid", () => {
    // Arrange
    const executor = new FileExecutor();

    // Act
    const result = executor.validate({ path: "../secret.txt", operation: "read" });

    // Assert
    expect(result.valid).toBe(false);
  });

  // DDUT-03-008001-00004 — REV-012 #2: relative path without traversal is valid
  it("validate_relativePath_returnsValid", () => {
    // Arrange
    const executor = new FileExecutor();

    // Act
    const result = executor.validate({ path: "data/output.txt", operation: "read" });

    // Assert
    expect(result.valid).toBe(true);
  });
});

// ============================
// HttpExecutor
// ============================
describe("HttpExecutor", () => {
  // DDUT-03-008002-00001
  it("validate_noUrl_returnsInvalid", () => {
    // Arrange
    const executor = new HttpExecutor();

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(false);
  });
});

// ============================
// TransformExecutor
// ============================
describe("TransformExecutor", () => {
  // DDUT-03-008003-00001
  it("validate_noExpression_returnsInvalid", () => {
    // Arrange
    const executor = new TransformExecutor();

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(false);
  });

  // DDUT-03-008003-00002
  it("execute_jsonParse_returnsObject", async () => {
    // Arrange
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "jsonParse", expression: "" },
      inputs: { in: '{"key":"value"}' },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
    expect(result.outputs?.out).toEqual({ key: "value" });
  });

  // DDUT-03-008003-00003
  it("execute_jsonStringify_returnsString", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "jsonStringify" },
      inputs: { in: { key: "value" } },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(JSON.parse(result.outputs.out as string)).toEqual({ key: "value" });
  });

  // DDUT-03-008003-00004
  it("execute_textReplace_replacesPattern", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "textReplace", expression: "hello|world" },
      inputs: { in: "hello foo" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("world foo");
  });

  // DDUT-03-008003-00005
  it("execute_textSplit_returnsArray", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "textSplit", expression: "," },
      inputs: { in: "a,b,c" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toEqual(["a", "b", "c"]);
  });

  // DDUT-03-008003-00006
  it("execute_textJoin_joinsArray", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "textJoin", expression: "-" },
      inputs: { in: ["a", "b", "c"] },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("a-b-c");
  });

  // DDUT-03-008003-00007
  it("execute_regex_returnsMatch", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "regex", expression: "(\\d+)" },
      inputs: { in: "foo 42 bar" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect((result.outputs.out as string[])[1]).toBe("42");
  });

  // DDUT-03-008003-00008
  it("execute_template_expandsTemplate", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "template", expression: "Hello {{input}}!" },
      inputs: { in: "World" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("Hello World!");
  });

  // DDUT-03-008003-00009
  it("execute_jsExpression_evaluatesExpression", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "jsExpression", expression: "input + 10" },
      inputs: { in: 5 },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe(15);
  });

  // DDUT-03-008003-00010
  it("execute_unknownTransformType_returnsError", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "nonexistent" },
      inputs: { in: "test" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("Unknown transform type");
  });

  // DDUT-03-008003-00011
  it("execute_abortedSignal_returnsCancelled", async () => {
    const executor = new TransformExecutor();
    const ac = new AbortController();
    ac.abort();
    const context = createContext({
      settings: { transformType: "jsonParse" },
      inputs: { in: "{}" },
      signal: ac.signal,
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("cancelled");
  });

  // DDUT-03-008003-00012
  it("execute_jsonParseInvalid_returnsError", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "jsonParse" },
      inputs: { in: "not json" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("error");
  });

  // DDUT-03-008003-00013
  it("execute_setVar_setsVariable", async () => {
    const executor = new TransformExecutor();
    const variables = new VariableStore();
    const context = createContext({
      settings: { transformType: "setVar", varName: "myVar" },
      inputs: { in: "value123" },
    });
    (context as any).variables = variables;
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("value123");
    expect(variables.get("myVar")).toBe("value123");
  });

  // DDUT-03-008003-00014
  it("execute_getVar_retrievesVariable", async () => {
    const executor = new TransformExecutor();
    const variables = new VariableStore();
    variables.set("myVar", "stored");
    const context = createContext({
      settings: { transformType: "getVar", varName: "myVar" },
      inputs: { in: "" },
    });
    (context as any).variables = variables;
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("stored");
  });

  // DDUT-03-008003-00015
  it("execute_getVar_defaultValueWhenNotSet", async () => {
    const executor = new TransformExecutor();
    const variables = new VariableStore();
    const context = createContext({
      settings: { transformType: "getVar", varName: "missing", defaultValue: "fallback" },
      inputs: { in: "" },
    });
    (context as any).variables = variables;
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("fallback");
  });

  // DDUT-03-008003-00016
  it("validate_jsExpressionWithoutExpression_returnsInvalid", () => {
    const executor = new TransformExecutor();
    const result = executor.validate({ transformType: "jsExpression" });
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]?.field).toBe("expression");
  });

  // DDUT-03-008003-00017
  it("validate_setVarWithoutVarName_returnsInvalid", () => {
    const executor = new TransformExecutor();
    const result = executor.validate({ transformType: "setVar" });
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]?.field).toBe("varName");
  });

  // DDUT-03-008003-00018
  it("execute_textJoin_nonArray_returnsString", async () => {
    const executor = new TransformExecutor();
    const context = createContext({
      settings: { transformType: "textJoin", expression: "-" },
      inputs: { in: "single" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("single");
  });
});
