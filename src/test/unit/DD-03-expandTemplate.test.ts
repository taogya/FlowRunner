// DD-03 expandTemplate UT tests
// Trace: DD-03-004002 テンプレート展開ヘルパー

import { describe, it, expect } from "vitest";
import { expandTemplate } from "@extension/executors/expandTemplate.js";

describe("expandTemplate", () => {
  // DDUT-03-004002-00001
  it("stringInput_replacesPlaceholder", () => {
    // Arrange
    const template = "Hello, {{input}}!";

    // Act
    const result = expandTemplate(template, "World");

    // Assert
    expect(result).toBe("Hello, World!");
  });

  // DDUT-03-004002-00002
  it("objectInput_replacesWithJsonStringify", () => {
    // Arrange
    const template = "Data: {{input}}";
    const input = { key: "value" };

    // Act
    const result = expandTemplate(template, input);

    // Assert
    expect(result).toBe('Data: {"key":"value"}');
  });

  // DDUT-03-004002-00003
  it("noPlaceholder_returnsUnchanged", () => {
    // Arrange
    const template = "No placeholders here";

    // Act
    const result = expandTemplate(template, "ignored");

    // Assert
    expect(result).toBe("No placeholders here");
  });

  // DDUT-03-004002-00004
  it("multiplePlaceholders_replacesAll", () => {
    // Arrange
    const template = "{{input}} and {{input}}";

    // Act
    const result = expandTemplate(template, "X");

    // Assert
    expect(result).toBe("X and X");
  });

  // DDUT-03-004002-00005 — {{input.xxx}} dot-notation
  it("inputDotNotation_replacesWithNestedProperty", () => {
    // Arrange
    const template = "Result: {{input.stdout}}";

    // Act
    const result = expandTemplate(template, { stdout: "hello" });

    // Assert
    expect(result).toBe("Result: hello");
  });

  // DDUT-03-004002-00006 — {{vars.xxx}} simple
  it("varsSimple_replacesWithVariableValue", () => {
    // Arrange
    const template = "Count: {{vars.count}}";
    const vars = { entries: () => [["count", 42] as [string, unknown]] };

    // Act
    const result = expandTemplate(template, null, vars);

    // Assert
    expect(result).toBe("Count: 42");
  });

  // DDUT-03-004002-00007 — {{vars.xxx}} string value
  it("varsString_replacesWithStringValue", () => {
    // Arrange
    const template = "Hello, {{vars.name}}!";
    const vars = { entries: () => [["name", "Alice"] as [string, unknown]] };

    // Act
    const result = expandTemplate(template, null, vars);

    // Assert
    expect(result).toBe("Hello, Alice!");
  });

  // DDUT-03-004002-00008 — {{vars.xxx}} nested path
  it("varsNestedPath_replacesWithNestedValue", () => {
    // Arrange
    const template = "Config: {{vars.config.host}}";
    const vars = { entries: () => [["config", { host: "localhost" }] as [string, unknown]] };

    // Act
    const result = expandTemplate(template, null, vars);

    // Assert
    expect(result).toBe("Config: localhost");
  });

  // DDUT-03-004002-00009 — {{vars.xxx}} missing key
  it("varsMissing_replacesWithNull", () => {
    // Arrange
    const template = "Value: {{vars.missing}}";
    const vars = { entries: () => [] as [string, unknown][] };

    // Act
    const result = expandTemplate(template, null, vars);

    // Assert
    expect(result).toBe("Value: null");
  });

  // DDUT-03-004002-00010 — {{vars.xxx}} without variables arg
  it("varsWithoutVariablesArg_templateUnchanged", () => {
    // Arrange
    const template = "{{vars.count}} items";

    // Act
    const result = expandTemplate(template, null);

    // Assert
    expect(result).toBe("{{vars.count}} items");
  });

  // DDUT-03-004002-00011 — mixed {{input}} + {{vars.xxx}}
  it("mixedInputAndVars_bothReplaced", () => {
    // Arrange
    const template = "{{input}} has {{vars.status}}";
    const vars = { entries: () => [["status", "active"] as [string, unknown]] };

    // Act
    const result = expandTemplate(template, "User", vars);

    // Assert
    expect(result).toBe("User has active");
  });
});
