// BD-01 Component & Dependency Integration Tests
// Trace: BD-01-003001 コンポーネント一覧, BD-01-003002 コンポーネント間の依存関係

import { describe, it, expect } from "vitest";

// Extension Host components
import { activate } from "@extension/core/extensionMain.js";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
import { FlowTreeProvider } from "@extension/ui/FlowTreeProvider.js";
import { FlowEditorManager } from "@extension/ui/FlowEditorManager.js";
import { MessageBroker } from "@extension/services/MessageBroker.js";
import { FlowService } from "@extension/services/FlowService.js";
import { ExecutionService } from "@extension/services/ExecutionService.js";
import { DebugService } from "@extension/services/DebugService.js";
import { HistoryService } from "@extension/services/HistoryService.js";
import { NodeExecutorRegistry } from "@extension/registries/NodeExecutorRegistry.js";
import { FlowRepository } from "@extension/repositories/FlowRepository.js";
import { HistoryRepository } from "@extension/repositories/HistoryRepository.js";

// Interfaces
import type { IFlowRepository } from "@extension/interfaces/IFlowRepository.js";
import type { IHistoryRepository } from "@extension/interfaces/IHistoryRepository.js";

import { Uri } from "vscode";

// --- BD-01-003001: コンポーネント一覧 ---

describe("Component List (BD-01-003001)", () => {
  // BDIT-01-003001-00001
  it("extensionHostComponents_allExportedAsClasses", () => {
    // Assert — all 12 Extension Host component classes exist
    // (INodeExecutor is an interface, not a class — excluded)
    expect(activate).toBeDefined();
    expect(CommandRegistry).toBeDefined();
    expect(FlowTreeProvider).toBeDefined();
    expect(FlowEditorManager).toBeDefined();
    expect(MessageBroker).toBeDefined();
    expect(FlowService).toBeDefined();
    expect(ExecutionService).toBeDefined();
    expect(DebugService).toBeDefined();
    expect(HistoryService).toBeDefined();
    expect(NodeExecutorRegistry).toBeDefined();
    expect(FlowRepository).toBeDefined();
    expect(HistoryRepository).toBeDefined();
  });
});

// --- BD-01-003002: コンポーネント間の依存関係 ---

describe("Component Dependencies (BD-01-003002)", () => {
  // BDIT-01-003002-00001
  it("flowService_acceptsFlowRepositoryViaDI", () => {
    // Arrange — mock FlowRepository implementing IFlowRepository
    const mockRepo: IFlowRepository = {
      save: async () => {},
      load: async () => ({ id: "f", name: "f", description: "", version: "1.0.0", nodes: [], edges: [], createdAt: "", updatedAt: "" }),
      list: async () => [],
      delete: async () => {},
      exists: async () => false,
      rename: async () => {},
    };

    // Act — FlowService accepts an IFlowRepository
    const svc = new FlowService(mockRepo);

    // Assert
    expect(svc).toBeInstanceOf(FlowService);
  });

  // BDIT-01-003002-00002
  it("historyService_acceptsHistoryRepositoryViaDI", () => {
    // Arrange
    const mockRepo: IHistoryRepository = {
      save: async () => {},
      load: async () => ({} as any),
      list: async () => [],
      delete: async () => {},
      count: async () => 0,
    };

    // Act
    const svc = new HistoryService(mockRepo, () => 10);

    // Assert
    expect(svc).toBeInstanceOf(HistoryService);
  });

  // BDIT-01-003002-00003
  it("nodeExecutorRegistry_canAcceptAndRetrieveExecutors", () => {
    // Arrange
    const registry = new NodeExecutorRegistry();
    const mockExecutor = {
      getMetadata: () => ({ nodeType: "test", label: "Test", icon: "⚡", category: "test", inputPorts: [], outputPorts: [], settingsSchema: [] }),
      validate: () => ({ valid: true }),
      execute: async () => ({ status: "success" as const, outputs: {}, duration: 0 }),
    };

    // Act
    registry.register("test", mockExecutor);

    // Assert — dependency wiring works
    expect(registry.get("test")).toBe(mockExecutor);
  });

  // BDIT-01-003002-00004
  it("historyRepository_acceptsFileSystemAndUriViaDI", () => {
    // Arrange
    const mockFs = {
      writeFile: async () => {},
      readFile: async () => new Uint8Array(),
      delete: async () => {},
      readDirectory: async () => [] as [string, number][],
      createDirectory: async () => {},
      stat: async () => ({ type: 1 }),
    };

    // Act
    const repo = new HistoryRepository(mockFs, Uri.file("/workspace"));

    // Assert
    expect(repo).toBeInstanceOf(HistoryRepository);
  });
});
