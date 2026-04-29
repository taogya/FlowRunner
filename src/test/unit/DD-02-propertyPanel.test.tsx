// @vitest-environment jsdom
// DD-02 PropertyPanel UT tests
// Trace: DD-02-008001, DD-02-008002, DD-02-008003

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PropertyPanel } from "@webview/components/PropertyPanel.js";
import type { INodeTypeMetadata, SettingFieldDef } from "@shared/types/node.js";
import type { NodeResult } from "@shared/types/execution.js";

// Helper: minimal selected node
function makeNode(id: string, settings: Record<string, unknown> = {}) {
  return { id, type: "test", label: "Test Node", position: { x: 0, y: 0 }, settings };
}

// Helper: minimal metadata
function makeMetadata(fields: SettingFieldDef[]): INodeTypeMetadata {
  return {
    nodeType: "test",
    label: "Test",
    icon: "icon",
    category: "general",
    inputPorts: [],
    outputPorts: [],
    settingsSchema: fields,
  };
}

describe("PropertyPanel", () => {
  const noop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  // --- DD-02-008001 ---
  // DDUT-02-008001-00001
  it("noSelectedNode_showsPlaceholder", () => {
    render(
      <PropertyPanel
        selectedNode={null}
        executionOutput={null}
        nodeMetadata={null}
        onSettingsChange={noop}
      />,
    );
    expect(
      screen.getByText(/ノードを選択してください|Select a node/i),
    ).toBeDefined();
  });

  // DDUT-02-008001-00002
  it("selectedNode_showsSectionHeaders", () => {
    render(
      <PropertyPanel
        selectedNode={makeNode("n1")}
        executionOutput={null}
        nodeMetadata={makeMetadata([])}
        onSettingsChange={noop}
      />,
    );
    expect(screen.getByText(/settings|設定/i)).toBeDefined();
    expect(screen.getByText(/output|出力/i)).toBeDefined();
  });

  // --- DD-02-008002 SettingsTab ---
  // DDUT-02-008002-00001
  it("settingsTab_rendersTextInput", () => {
    const meta = makeMetadata([
      { key: "name", label: "Name", type: "string", required: true },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { name: "hello" })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={noop}
      />,
    );
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.value).toBe("hello");
  });

  // DDUT-02-008002-00002
  it("settingsTab_rendersNumberInput", () => {
    const meta = makeMetadata([
      { key: "count", label: "Count", type: "number", required: false, defaultValue: 0 },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { count: 42 })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={noop}
      />,
    );
    const input = screen.getByLabelText("Count") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.value).toBe("42");
  });

  // DDUT-02-008002-00003
  it("settingsTab_rendersCheckbox", () => {
    const meta = makeMetadata([
      { key: "verbose", label: "Verbose", type: "boolean", required: false },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { verbose: true })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={noop}
      />,
    );
    const input = screen.getByLabelText("Verbose") as HTMLInputElement;
    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(true);
  });

  // DDUT-02-008002-00004
  it("settingsTab_rendersTextarea", () => {
    const meta = makeMetadata([
      { key: "body", label: "Body", type: "text", required: false },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { body: "content" })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={noop}
      />,
    );
    const textarea = screen.getByLabelText("Body") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.value).toBe("content");
  });

  // DDUT-02-008002-00005
  it("settingsTab_rendersSelect", () => {
    const meta = makeMetadata([
      {
        key: "method",
        label: "Method",
        type: "select",
        required: true,
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
        ],
      },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { method: "POST" })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={noop}
      />,
    );
    const select = screen.getByLabelText("Method") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(select.value).toBe("POST");
  });

  // DDUT-02-008002-00006
  it("settingsTab_debouncesOnSettingsChange", () => {
    const onChange = vi.fn();
    const meta = makeMetadata([
      { key: "name", label: "Name", type: "string", required: false },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { name: "" })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={onChange}
      />,
    );

    const input = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });

    // Before debounce: not called
    expect(onChange).not.toHaveBeenCalled();

    // After 300ms debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("n1", { name: "abc" });
  });

  // --- DD-02-008003 OutputTab ---
  // DDUT-02-008003-00001
  it("outputTab_showsNotExecuted", () => {
    render(
      <PropertyPanel
        selectedNode={makeNode("n1")}
        executionOutput={null}
        nodeMetadata={makeMetadata([])}
        onSettingsChange={noop}
      />,
    );
    expect(screen.getByText(/未実行|not executed/i)).toBeDefined();
  });

  // DDUT-02-008003-00002
  it("outputTab_showsJsonOutput", () => {
    const output: NodeResult = {
      nodeId: "n1",
      nodeType: "test",
      nodeLabel: "Test",
      status: "success",
      inputs: {},
      outputs: { result: "hello" },
      duration: 100,
    };
    render(
      <PropertyPanel
        selectedNode={makeNode("n1")}
        executionOutput={output}
        nodeMetadata={makeMetadata([])}
        onSettingsChange={noop}
      />,
    );
    // JSON output should be rendered in <pre>
    const pre = document.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain('"result"');
    expect(pre!.textContent).toContain('"hello"');
  });

  // DDUT-02-008003-00003
  it("outputTab_showsErrorMessage", () => {
    const output: NodeResult = {
      nodeId: "n1",
      nodeType: "test",
      nodeLabel: "Test",
      status: "error",
      inputs: {},
      outputs: {},
      duration: 50,
      error: { message: "Something went wrong" },
    };
    render(
      <PropertyPanel
        selectedNode={makeNode("n1")}
        executionOutput={output}
        nodeMetadata={makeMetadata([])}
        onSettingsChange={noop}
      />,
    );
    expect(screen.getByText(/Something went wrong/)).toBeDefined();
  });

  // DDUT-02-008001-00003
  it("outputSection_isExpandedByDefault", () => {
    render(
      <PropertyPanel
        selectedNode={makeNode("n1")}
        executionOutput={null}
        nodeMetadata={makeMetadata([])}
        onSettingsChange={noop}
      />,
    );

    expect(screen.getByText(/未実行|not executed/i)).toBeDefined();
  });

  // --- DD-02-008002 keyValue field ---
  // DDUT-02-008002-00007
  it("settingsTab_keyValue_rendersExistingPairs", () => {
    const meta = makeMetadata([
      { key: "envVars", label: "Environment Variables", type: "keyValue" as any, required: false },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { envVars: [{ key: "FOO", value: "bar" }, { key: "BAZ", value: "qux" }] })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={noop}
      />,
    );
    const inputs = screen.getAllByPlaceholderText("Key") as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe("FOO");
    expect(inputs[1].value).toBe("BAZ");
  });

  // DDUT-02-008002-00008
  it("settingsTab_keyValue_addButtonAddsPair", () => {
    const meta = makeMetadata([
      { key: "envVars", label: "Environment Variables", type: "keyValue" as any, required: false },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { envVars: [{ key: "A", value: "1" }] })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={noop}
      />,
    );

    const addBtn = screen.getByText("+ Add");
    fireEvent.click(addBtn);

    const inputs = screen.getAllByPlaceholderText("Key") as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    expect(inputs[1].value).toBe(""); // new empty pair
  });

  // DDUT-02-008002-00009
  it("settingsTab_keyValue_removeButtonRemovesPair", () => {
    const onChange = vi.fn();
    const meta = makeMetadata([
      { key: "envVars", label: "Environment Variables", type: "keyValue" as any, required: false },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { envVars: [{ key: "A", value: "1" }, { key: "B", value: "2" }] })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={onChange}
      />,
    );

    const removeBtns = screen.getAllByLabelText("Remove");
    expect(removeBtns).toHaveLength(2);
    fireEvent.click(removeBtns[0]); // Remove first pair

    // After removal, should have 1 pair remaining
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledWith("n1", expect.objectContaining({
      envVars: [{ key: "B", value: "2" }],
    }));
  });

  // DDUT-02-008002-00010
  it("settingsTab_keyValue_emptySettings_showsOneEmptyPair", () => {
    const meta = makeMetadata([
      { key: "envVars", label: "Environment Variables", type: "keyValue" as any, required: false },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", {})}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={noop}
      />,
    );
    const inputs = screen.getAllByPlaceholderText("Key") as HTMLInputElement[];
    expect(inputs).toHaveLength(1);
    expect(inputs[0].value).toBe(""); // default empty pair
  });

  // DDUT-02-008002-00011
  it("settingsTab_keyValue_objectSettings_convertsToArray", () => {
    const meta = makeMetadata([
      { key: "envVars", label: "Environment Variables", type: "keyValue" as any, required: false },
    ]);
    render(
      <PropertyPanel
        selectedNode={makeNode("n1", { envVars: { FOO: "bar" } })}
        executionOutput={null}
        nodeMetadata={meta}
        onSettingsChange={noop}
      />,
    );
    const keyInputs = screen.getAllByPlaceholderText("Key") as HTMLInputElement[];
    const valInputs = screen.getAllByPlaceholderText("Value") as HTMLInputElement[];
    expect(keyInputs).toHaveLength(1);
    expect(keyInputs[0].value).toBe("FOO");
    expect(valInputs[0].value).toBe("bar");
  });
});
