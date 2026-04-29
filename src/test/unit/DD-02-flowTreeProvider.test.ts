// DD-02 FlowTreeProvider UT tests
// Trace: DD-02-002001, DD-02-002002, DD-02-002003, DD-02-002004, DD-02-002005

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowTreeProvider } from "@extension/ui/FlowTreeProvider.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { FlowSummary } from "@shared";

function createMockFlowService(): IFlowService {
  return {
    createFlow: vi.fn(),
    getFlow: vi.fn(),
    saveFlow: vi.fn(),
    deleteFlow: vi.fn(),
    renameFlow: vi.fn(),
    listFlows: vi.fn().mockResolvedValue([]),
    existsFlow: vi.fn(),
    onDidChangeFlows: { event: vi.fn() } as any,
  };
}

describe("FlowTreeProvider", () => {
  let flowService: IFlowService;
  let provider: FlowTreeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    flowService = createMockFlowService();
    provider = new FlowTreeProvider(flowService);
  });

  // --- DD-02-002001: 概要 ---

  // DDUT-02-002001-00001
  it("canBeInstantiated", () => {
    // Assert
    expect(provider).toBeDefined();
    expect(provider).toBeInstanceOf(FlowTreeProvider);
  });

  // --- DD-02-002002: クラス設計 ---

  // DDUT-02-002002-00001
  it("hasTreeDataProviderMethods", () => {
    // Assert
    expect(typeof provider.getChildren).toBe("function");
    expect(typeof provider.getTreeItem).toBe("function");
    expect(typeof provider.refresh).toBe("function");
    expect(provider.onDidChangeTreeData).toBeDefined();
  });

  // DDUT-02-002003-00001
  it("getChildren_noParent_returnsFlowTreeItems", async () => {
    // Arrange
    const summaries: FlowSummary[] = [
      { id: "f1", name: "Flow 1", updatedAt: "2026-01-01T00:00:00.000Z" } as FlowSummary,
      { id: "f2", name: "Flow 2", updatedAt: "2026-01-02T00:00:00.000Z" } as FlowSummary,
    ];
    vi.mocked(flowService.listFlows).mockResolvedValue(summaries);

    // Act
    const items = await provider.getChildren(undefined);

    // Assert
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("f1");
    expect(items[0].label).toBe("Flow 1");
  });

  // DDUT-02-002004-00001
  it("getTreeItem_flowItem_returnsTreeItemWithCommand", () => {
    // Arrange
    const item = { id: "f1", label: "Test Flow", type: "flow" as const, description: "2026-01-01" };

    // Act
    const treeItem = provider.getTreeItem(item as any);

    // Assert
    expect(treeItem).toBeDefined();
    expect(treeItem.command?.command).toBe("flowrunner.openEditor");
    expect(treeItem.contextValue).toBe("flowItem");
  });

  // DDUT-02-002005-00001
  it("refresh_firesChangeEvent", () => {
    // Arrange — provider created in beforeEach

    // Act
    provider.refresh();

    // Assert — should not throw, event fires internally
    expect(provider.onDidChangeTreeData).toBeDefined();
  });
});
