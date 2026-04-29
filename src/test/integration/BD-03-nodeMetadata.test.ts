// BD-03 ノードメタデータ IT tests
// Trace: BD-03-004001 INodeTypeMetadata,
//        BD-03-004002 PortDefinition,
//        BD-03-004003 SettingFieldDef

import { describe, it, expect } from "vitest";
import type {
  INodeTypeMetadata,
  PortDefinition,
  SettingFieldDef,
  FieldType,
} from "@shared/types/node.js";
import { CommandExecutor } from "@extension/executors/CommandExecutor.js";
import { ConditionExecutor } from "@extension/executors/ConditionExecutor.js";
import { TriggerExecutor } from "@extension/executors/TriggerExecutor.js";

// --- BD-03-004001: INodeTypeMetadata ---

describe("INodeTypeMetadata (BD-03-004001)", () => {
  // BDIT-03-004001-00001
  it("metadata_hasAllRequiredFields", () => {
    const executor = new CommandExecutor();
    const meta: INodeTypeMetadata = executor.getMetadata();

    expect(typeof meta.nodeType).toBe("string");
    expect(typeof meta.label).toBe("string");
    expect(typeof meta.icon).toBe("string");
    expect(typeof meta.category).toBe("string");
    expect(Array.isArray(meta.inputPorts)).toBe(true);
    expect(Array.isArray(meta.outputPorts)).toBe(true);
    expect(Array.isArray(meta.settingsSchema)).toBe(true);
  });

  // BDIT-03-004001-00002
  it("metadata_usedByUI_providesNodeTypeAndLabel", () => {
    const executors = [
      new TriggerExecutor(),
      new CommandExecutor(),
      new ConditionExecutor(),
    ];

    for (const executor of executors) {
      const meta = executor.getMetadata();
      expect(meta.nodeType.length).toBeGreaterThan(0);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.category.length).toBeGreaterThan(0);
    }
  });
});

// --- BD-03-004002: PortDefinition ---

describe("PortDefinition (BD-03-004002)", () => {
  // BDIT-03-004002-00001
  it("portDefinition_hasIdLabelAndDataType", () => {
    const executor = new CommandExecutor();
    const meta = executor.getMetadata();

    for (const port of meta.inputPorts) {
      const p: PortDefinition = port;
      expect(typeof p.id).toBe("string");
      expect(typeof p.label).toBe("string");
      expect(typeof p.dataType).toBe("string");
    }

    for (const port of meta.outputPorts) {
      const p: PortDefinition = port;
      expect(typeof p.id).toBe("string");
      expect(typeof p.label).toBe("string");
      expect(typeof p.dataType).toBe("string");
    }
  });

  // BDIT-03-004002-00002
  it("commandExecutor_hasTwoOutputPorts_stdoutAndStderr", () => {
    const executor = new CommandExecutor();
    const meta = executor.getMetadata();

    expect(meta.outputPorts).toHaveLength(2);
    const portIds = meta.outputPorts.map((p) => p.id);
    expect(portIds).toContain("stdout");
    expect(portIds).toContain("stderr");
  });

  // BDIT-03-004002-00003
  it("triggerExecutor_hasNoInputPorts", () => {
    const executor = new TriggerExecutor();
    const meta = executor.getMetadata();

    expect(meta.inputPorts).toHaveLength(0);
    expect(meta.outputPorts.length).toBeGreaterThan(0);
  });
});

// --- BD-03-004003: SettingFieldDef ---

describe("SettingFieldDef (BD-03-004003)", () => {
  // BDIT-03-004003-00001
  it("settingFieldDef_hasRequiredProperties", () => {
    const executor = new CommandExecutor();
    const meta = executor.getMetadata();

    expect(meta.settingsSchema.length).toBeGreaterThan(0);

    for (const field of meta.settingsSchema) {
      const f: SettingFieldDef = field;
      expect(typeof f.key).toBe("string");
      expect(typeof f.label).toBe("string");
      expect(typeof f.type).toBe("string");
      expect(typeof f.required).toBe("boolean");
    }
  });

  // BDIT-03-004003-00002
  it("fieldType_usesValidValues", () => {
    const executor = new CommandExecutor();
    const meta = executor.getMetadata();

    const validFieldTypes: FieldType[] = [
      "string", "text", "number", "boolean", "select", "keyValue",
    ];

    for (const field of meta.settingsSchema) {
      expect(validFieldTypes).toContain(field.type);
    }
  });

  // BDIT-03-004003-00003
  it("selectField_hasOptions", () => {
    const executor = new CommandExecutor();
    const meta = executor.getMetadata();

    const selectFields = meta.settingsSchema.filter((f) => f.type === "select");
    expect(selectFields.length).toBeGreaterThan(0);

    for (const field of selectFields) {
      expect(field.options).toBeDefined();
      expect(field.options!.length).toBeGreaterThan(0);
      for (const option of field.options!) {
        expect(typeof option.value).toBe("string");
        expect(typeof option.label).toBe("string");
      }
    }
  });
});
