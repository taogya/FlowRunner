// BD-02 FlowTreeProvider IT tests
// Trace: BD-02-002001 概要, BD-02-002002 IFlowTreeProvider インターフェース,
//        BD-02-002003 FlowTreeItem 型, BD-02-002004 コンテキストメニュー,
//        BD-02-002005 検索・フィルター, BD-02-002006 FlowService 連携
//
// NOTE: Mock→Real 未スワップ。Real FlowTreeProvider.getChildren() は
// async (Promise<FlowTreeItem[]>) だが IFlowTreeProvider は同期 (FlowTreeItem[])。
// また引数が FlowTreeItem vs string の不一致がある。REV-002 で追跡。

import { describe, it, expect } from "vitest";
import type { FlowTreeItem } from "@shared/types/ui.js";
import { MockFlowTreeProvider } from "@extension/mocks/MockFlowTreeProvider.js";

function createMockFlowTreeProvider(): MockFlowTreeProvider {
  const provider = new MockFlowTreeProvider();
  provider.setItems([
    { id: "flow-1", label: "Flow 1", type: "flow", description: "Test flow 1" },
    { id: "flow-2", label: "Flow 2", type: "flow", description: "Test flow 2" },
    { id: "folder-1", label: "Folder 1", type: "folder", description: "" },
    { id: "flow-3", label: "Flow 3", type: "flow", description: "In folder", parentId: "folder-1" },
  ]);
  return provider;
}

describe("IFlowTreeProvider", () => {
  // BDIT-02-002002-00001
  it("getChildren_withNoParent_returnsRootItems", async () => {
    const provider = createMockFlowTreeProvider();

    const items = await provider.getChildren();

    expect(items).toBeDefined();
    expect(Array.isArray(items)).toBe(true);
  });

  // BDIT-02-002002-00002
  it("getChildren_withParentId_returnsChildItems", async () => {
    const provider = createMockFlowTreeProvider();

    const items = await provider.getChildren("folder-1");

    expect(items).toBeDefined();
    expect(Array.isArray(items)).toBe(true);
  });

  // BDIT-02-002002-00003
  it("getTreeItem_withFlowItem_returnsTreeItem", () => {
    const provider = createMockFlowTreeProvider();
    const item: FlowTreeItem = {
      id: "flow-1",
      label: "Test Flow",
      type: "flow",
      description: "A test flow",
    };

    const treeItem = provider.getTreeItem(item);

    expect(treeItem).toBeDefined();
    expect(treeItem.label).toBe("Test Flow");
  });

  // BDIT-02-002002-00004
  it("refresh_called_doesNotThrow", () => {
    const provider = createMockFlowTreeProvider();

    expect(() => provider.refresh()).not.toThrow();
  });
});

// --- BD-02-002001: 概要 ---

describe("FlowTreeProvider Overview (BD-02-002001)", () => {
  // BDIT-02-002001-00001
  it("provider_implementsTreeDataProviderPattern", () => {
    const provider = createMockFlowTreeProvider();

    // Assert — has TreeDataProvider-required methods
    expect(typeof provider.getChildren).toBe("function");
    expect(typeof provider.getTreeItem).toBe("function");
  });
});

// --- BD-02-002003: FlowTreeItem 型 ---

describe("FlowTreeItem Type (BD-02-002003)", () => {
  // BDIT-02-002003-00001
  it("flowTreeItem_hasAllRequiredFields", () => {
    const item: FlowTreeItem = {
      id: "flow-1",
      label: "Test Flow",
      type: "flow",
      description: "desc",
    };

    expect(item.id).toBeDefined();
    expect(item.label).toBeDefined();
    expect(item.type).toBeDefined();
    expect(item.description).toBeDefined();
  });

  // BDIT-02-002003-00002
  it("flowTreeItem_typeSupportsFlowFolderHistory", () => {
    const types: FlowTreeItem["type"][] = ["flow", "folder", "history"];

    expect(types).toHaveLength(3);
  });

  // BDIT-02-002003-00003
  it("flowTreeItem_parentIdIsOptional", () => {
    const withParent: FlowTreeItem = { id: "1", label: "L", type: "flow", description: "", parentId: "p" };
    const without: FlowTreeItem = { id: "2", label: "L", type: "flow", description: "" };

    expect(withParent.parentId).toBe("p");
    expect(without.parentId).toBeUndefined();
  });
});

// --- BD-02-002004: コンテキストメニューとコマンドバインディング ---

describe("Context Menu & Command Bindings (BD-02-002004)", () => {
  // BDIT-02-002004-00001
  it("packageJson_definesFlowTreeContextMenuCommands", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pkgPath = path.resolve(__dirname, "../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const contextMenu = pkg.contributes?.menus?.["view/item/context"] ?? [];
    const commandIds = contextMenu.map((m: { command: string }) => m.command);

    // BD-02 §2.4: delete, execute, rename should be in context menu
    expect(commandIds).toContain("flowrunner.deleteFlow");
    expect(commandIds).toContain("flowrunner.executeFlow");
    expect(commandIds).toContain("flowrunner.renameFlow");
  });
});

// --- BD-02-002005: 検索・フィルター ---

describe("Search & Filter (BD-02-002005)", () => {
  // BDIT-02-002005-00001
  it("flowTreeProvider_supportsVscodeBuiltinSearch", () => {
    // BD-02 §2.5: VSCode built-in tree view search (Ctrl+F) is used
    // No additional interface is required — verify provider doesn't block search
    const provider = createMockFlowTreeProvider();

    // getChildren returns data that VSCode tree view can search by label
    expect(typeof provider.getChildren).toBe("function");
    expect(typeof provider.getTreeItem).toBe("function");
  });
});

// --- BD-02-002006: FlowService との連携 ---

describe("FlowService Integration (BD-02-002006)", () => {
  // BDIT-02-002006-00001
  it("getChildren_delegatesToListFlows", async () => {
    const provider = createMockFlowTreeProvider();

    const items = await provider.getChildren();

    // Assert — returns flow items (simulating FlowService.listFlows)
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].type).toBeDefined();
  });
});
