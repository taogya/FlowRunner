// DD-01 FlowService UT tests
// Trace: DD-01-003001, DD-01-003002, DD-01-003003, DD-01-003004, DD-01-003005

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowService } from "@extension/services/FlowService.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IFlowRepository } from "@extension/interfaces/IFlowRepository.js";
import type { FlowDefinition, FlowSummary } from "@shared";

function createMockFlowRepository(): IFlowRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(false),
  };
}

function sampleFlow(overrides: Partial<FlowDefinition> = {}): FlowDefinition {
  return {
    id: "flow-1",
    name: "Test Flow",
    version: "1.0.0",
    nodes: [],
    edges: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as FlowDefinition;
}

describe("FlowService", () => {
  let repo: IFlowRepository;
  let service: FlowService;

  beforeEach(() => {
    repo = createMockFlowRepository();
    service = new FlowService(repo);
  });

  // --- DD-01-003001: 概要 ---

  // DDUT-01-003001-00001
  it("canBeInstantiated", () => {
    // Assert
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(FlowService);
  });

  // --- DD-01-003002: IFlowService インターフェース ---

  // DDUT-01-003002-00001
  it("implementsIFlowServiceMethods", () => {
    // Assert — all IFlowService methods exist
    const svc: IFlowService = service as unknown as IFlowService;
    expect(typeof svc.createFlow).toBe("function");
    expect(typeof svc.getFlow).toBe("function");
    expect(typeof svc.saveFlow).toBe("function");
    expect(typeof svc.deleteFlow).toBe("function");
    expect(typeof svc.renameFlow).toBe("function");
    expect(typeof svc.listFlows).toBe("function");
    expect(typeof svc.existsFlow).toBe("function");
  });

  // --- DD-01-003003: クラス設計 ---

  // DDUT-01-003003-00001
  it("hasOnDidChangeFlowsEventEmitter", () => {
    // Assert
    expect(service.onDidChangeFlows).toBeDefined();
    expect(typeof service.onDidChangeFlows.fire).toBe("function");
  });

  // DDUT-01-003004-00001
  it("createFlow_validName_returnsFlowDefinition", async () => {
    // Arrange — repo.save is already mocked

    // Act
    const flow = await service.createFlow("My Flow");

    // Assert
    expect(flow).toBeDefined();
    expect(flow.name).toBe("My Flow");
    expect(flow.version).toBe("1.0.0");
    expect(repo.save).toHaveBeenCalledOnce();
  });

  // DDUT-01-003004-00002
  it("createFlow_generatesUniqueId", async () => {
    // Act
    const flow1 = await service.createFlow("Flow A");
    const flow2 = await service.createFlow("Flow B");

    // Assert
    expect(flow1.id).toBeDefined();
    expect(flow2.id).toBeDefined();
    expect(flow1.id).not.toBe(flow2.id);
  });

  // DDUT-01-003004-00003
  it("getFlow_existingId_returnsFlowDefinition", async () => {
    // Arrange
    const flow = sampleFlow();
    vi.mocked(repo.load).mockResolvedValue(flow);

    // Act
    const result = await service.getFlow("flow-1");

    // Assert
    expect(result).toBe(flow);
    expect(repo.load).toHaveBeenCalledWith("flow-1");
  });

  // DDUT-01-003004-00004
  it("getFlow_unknownId_throws", async () => {
    // Arrange
    vi.mocked(repo.load).mockRejectedValue(new Error("Flow not found"));

    // Act & Assert
    await expect(service.getFlow("unknown")).rejects.toThrow("Flow not found");
  });

  // DDUT-01-003004-00005
  it("saveFlow_updatesTimestampAndPersists", async () => {
    // Arrange
    const flow = sampleFlow({ updatedAt: "2020-01-01T00:00:00.000Z" });

    // Act
    await service.saveFlow(flow);

    // Assert
    expect(repo.save).toHaveBeenCalledOnce();
    const savedFlow = vi.mocked(repo.save).mock.calls[0][0];
    expect(savedFlow.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
  });

  // DDUT-01-003004-00006
  it("deleteFlow_callsRepositoryDelete", async () => {
    // Act
    await service.deleteFlow("flow-1");

    // Assert
    expect(repo.delete).toHaveBeenCalledWith("flow-1");
  });

  // DDUT-01-003004-00007
  it("renameFlow_updatesNameAndSaves", async () => {
    // Arrange
    const flow = sampleFlow({ name: "Old Name" });
    vi.mocked(repo.load).mockResolvedValue(flow);

    // Act
    await service.renameFlow("flow-1", "New Name");

    // Assert
    expect(repo.save).toHaveBeenCalledOnce();
    const savedFlow = vi.mocked(repo.save).mock.calls[0][0];
    expect(savedFlow.name).toBe("New Name");
  });

  // DDUT-01-003004-00008
  it("listFlows_returnsFlowSummaries", async () => {
    // Arrange
    const summaries: FlowSummary[] = [
      { id: "f1", name: "Flow 1", updatedAt: "2026-01-01" } as FlowSummary,
    ];
    vi.mocked(repo.list).mockResolvedValue(summaries);

    // Act
    const result = await service.listFlows();

    // Assert
    expect(result).toBe(summaries);
  });

  // DDUT-01-003004-00009
  it("existsFlow_delegatesToRepository", async () => {
    // Arrange
    vi.mocked(repo.exists).mockResolvedValue(true);

    // Act
    const result = await service.existsFlow("flow-1");

    // Assert
    expect(result).toBe(true);
    expect(repo.exists).toHaveBeenCalledWith("flow-1");
  });

  // DDUT-01-003005-00001
  it("createFlow_containsTriggerNode", async () => {
    // Act
    const flow = await service.createFlow("With Trigger");

    // Assert
    expect(flow.nodes).toHaveLength(1);
    expect(flow.nodes[0].type).toBe("trigger");
    expect(flow.nodes[0].label).toBe("Trigger");
    expect(flow.nodes[0].position).toEqual({ x: 250, y: 50 });
  });
});
