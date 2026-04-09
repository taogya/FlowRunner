// Trace: DD-04-005001, DD-04-005002, DD-04-005003, DD-04-005004
import type { IHistoryRepository } from "@extension/interfaces/IHistoryRepository.js";
import type { HistoryRecordsWithDiagnostics } from "@extension/interfaces/HistoryRecordsWithDiagnostics.js";
import type { ExecutionRecord, ExecutionSummary } from "@shared/types/execution.js";

interface IFileSystem {
  writeFile(uri: unknown, content: Uint8Array): Promise<void>;
  readFile(uri: unknown): Promise<Uint8Array>;
  delete(uri: unknown): Promise<void>;
  readDirectory(uri: unknown): Promise<[string, number][]>;
  createDirectory(uri: unknown): Promise<void>;
  stat(uri: unknown): Promise<{ type: number }>;
}

import { Uri } from "vscode";

function validateId(id: string): void {
  if (id.includes("..") || id.includes("/") || id.includes("\\")) {
    throw new Error(`Invalid ID: ${id}`);
  }
}

// Trace: DD-04-005003 — フローファイル命名規則と統一
function sanitizeName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "flow";
}

function buildHistoryDirName(flowName: string, flowId: string): string {
  return `${sanitizeName(flowName)}_${flowId.slice(0, 8)}`;
}

function isExecutionRecord(value: unknown): value is ExecutionRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<ExecutionRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.flowId === "string" &&
    typeof record.flowName === "string" &&
    typeof record.startedAt === "string" &&
    typeof record.duration === "number" &&
    typeof record.status === "string" &&
    Array.isArray(record.nodeResults)
  );
}

export class HistoryRepository implements IHistoryRepository {
  private readonly fs: IFileSystem;
  private readonly workspaceRoot: Uri;

  constructor(fs: IFileSystem, workspaceRoot: Uri) {
    this.fs = fs;
    this.workspaceRoot = workspaceRoot;
  }

  private getHistoryBase(): Uri {
    return Uri.file(`${this.workspaceRoot.fsPath}/.flowrunner/history`);
  }

  // Trace: DD-04-005003 — scan for history dir by shortId suffix, fallback to bare flowId
  private async findHistoryDir(flowId: string): Promise<Uri | undefined> {
    const shortId = flowId.slice(0, 8);
    const base = this.getHistoryBase();
    try {
      const entries = await this.fs.readDirectory(base);
      // New format: dir ending with _<shortId>
      const newMatch = entries.find(([name]) => name.endsWith(`_${shortId}`));
      if (newMatch) return Uri.file(`${base.fsPath}/${newMatch[0]}`);
      // Fallback: old format (bare flowId)
      const oldMatch = entries.find(([name]) => name === flowId);
      if (oldMatch) return Uri.file(`${base.fsPath}/${oldMatch[0]}`);
    } catch {
      // history base doesn't exist yet
    }
    return undefined;
  }

  // Trace: DD-04-005004
  async save(record: ExecutionRecord): Promise<void> {
    validateId(record.flowId);
    const dirName = buildHistoryDirName(record.flowName, record.flowId);
    const dir = Uri.file(`${this.getHistoryBase().fsPath}/${dirName}`);
    await this.fs.createDirectory(dir);
    const uri = Uri.file(`${dir.fsPath}/${record.id}.json`);
    const content = new TextEncoder().encode(JSON.stringify(record, null, 2));
    await this.fs.writeFile(uri, content);
  }

  async load(recordId: string): Promise<ExecutionRecord> {
    const flowId = recordId.split("_")[0];
    validateId(flowId);
    const dir = await this.findHistoryDir(flowId);
    if (!dir) throw new Error(`History not found: ${recordId}`);
    const uri = Uri.file(`${dir.fsPath}/${recordId}.json`);
    const data = await this.fs.readFile(uri);
    return JSON.parse(new TextDecoder().decode(data)) as ExecutionRecord;
  }

  async list(flowId: string): Promise<ExecutionSummary[]> {
    return (await this.listWithDiagnostics(flowId)).summaries;
  }

  async listWithDiagnostics(flowId: string): Promise<HistoryRecordsWithDiagnostics> {
    validateId(flowId);
    const dir = await this.findHistoryDir(flowId);
    if (!dir) {
      return { summaries: [], unreadableCount: 0 };
    }
    const entries = await this.fs.readDirectory(dir);
    const records: ExecutionRecord[] = [];
    let unreadableCount = 0;

    for (const [name] of entries) {
      if (!name.endsWith(".json")) continue;
      const uri = Uri.file(`${dir.fsPath}/${name}`);
      try {
        const data = await this.fs.readFile(uri);
        const decoded = JSON.parse(new TextDecoder().decode(data)) as unknown;
        if (!isExecutionRecord(decoded)) {
          unreadableCount += 1;
          continue;
        }
        records.push(decoded);
      } catch {
        unreadableCount += 1;
        continue;
      }
    }

    records.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    return {
      summaries: records.map((r) => ({
        id: r.id,
        flowId: r.flowId,
        flowName: r.flowName,
        startedAt: r.startedAt,
        duration: r.duration,
        status: r.status,
      })),
      unreadableCount,
    };
  }

  async delete(recordId: string): Promise<void> {
    const flowId = recordId.split("_")[0];
    validateId(flowId);
    const dir = await this.findHistoryDir(flowId);
    if (!dir) throw new Error(`History not found: ${recordId}`);
    const uri = Uri.file(`${dir.fsPath}/${recordId}.json`);
    await this.fs.delete(uri);
  }

  async count(flowId: string): Promise<number> {
    try {
      validateId(flowId);
      const dir = await this.findHistoryDir(flowId);
      if (!dir) return 0;
      const entries = await this.fs.readDirectory(dir);
      return entries.filter(([name]) => name.endsWith(".json")).length;
    } catch {
      return 0;
    }
  }
}
