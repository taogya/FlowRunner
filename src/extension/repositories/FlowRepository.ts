// Trace: DD-03-003001, DD-03-003002, DD-03-003003, DD-03-003004, DD-03-003005
import type { IFlowRepository } from "@extension/interfaces/IFlowRepository.js";
import type { FlowDefinition, FlowSummary } from "@shared/types/flow.js";

interface IFileSystem {
  writeFile(uri: unknown, content: Uint8Array): Promise<void>;
  readFile(uri: unknown): Promise<Uint8Array>;
  delete(uri: unknown): Promise<void>;
  readDirectory(uri: unknown): Promise<[string, number][]>;
  createDirectory(uri: unknown): Promise<void>;
  stat(uri: unknown): Promise<{ type: number }>;
}

import { Uri } from "vscode";

// Trace: DD-03-003005
function validateFlowId(flowId: string): void {
  if (flowId.includes("..") || flowId.includes("/") || flowId.includes("\\")) {
    throw new Error(`Invalid flow ID: ${flowId}`);
  }
}

// Sanitize flow name for use in filenames
function sanitizeName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "flow";
}

// Build filename: sanitizedName_flowId.json (full flowId to avoid collisions)
function buildFileName(name: string, flowId: string): string {
  return `${sanitizeName(name)}_${flowId}.json`;
}

export class FlowRepository implements IFlowRepository {
  private readonly fs: IFileSystem;
  private readonly workspaceRoot: Uri;

  constructor(fs: IFileSystem, workspaceRoot: Uri) {
    this.fs = fs;
    this.workspaceRoot = workspaceRoot;
  }

  // Trace: DD-03-003004
  private getBaseDir(): Uri {
    return Uri.file(`${this.workspaceRoot.fsPath}/.flowrunner`);
  }

  private getFlowUri(fileName: string): Uri {
    return Uri.file(`${this.workspaceRoot.fsPath}/.flowrunner/${fileName}`);
  }

  private async ensureBaseDir(): Promise<void> {
    await this.fs.createDirectory(this.getBaseDir());
  }

  // Find the filename for a given flowId by scanning the directory
  private async findFlowFile(flowId: string): Promise<string | undefined> {
    const baseDir = this.getBaseDir();
    let entries: [string, number][];
    try {
      entries = await this.fs.readDirectory(baseDir);
    } catch {
      return undefined;
    }
    // Fast path: match full flowId suffix (current convention)
    const fullMatch = entries.find(([name]) =>
      name.endsWith(`_${flowId}.json`)
    );
    if (fullMatch) return fullMatch[0];

    // Legacy path: match old shortId convention (first 8 chars)
    const shortId = flowId.slice(0, 8);
    const shortMatches = entries.filter(([name]) =>
      name.endsWith(`_${shortId}.json`)
    );
    // Only use shortId match if exactly one file matches (avoid ambiguity)
    if (shortMatches.length === 1) return shortMatches[0][0];

    // Fallback: read file content to match exact flowId (handles non-standard filenames)
    for (const [name, type] of entries) {
      if (type !== 1 || !name.endsWith(".json")) continue;
      try {
        const uri = this.getFlowUri(name);
        const data = await this.fs.readFile(uri);
        const flow = JSON.parse(new TextDecoder().decode(data)) as { id?: string };
        if (flow.id === flowId) return name;
      } catch {
        // skip unreadable files
      }
    }
    return undefined;
  }

  // Trace: DD-03-003003
  async save(flow: FlowDefinition): Promise<void> {
    await this.ensureBaseDir();
    const newFileName = buildFileName(flow.name, flow.id);
    // Remove old file if filename changed (rename or migration)
    const oldFile = await this.findFlowFile(flow.id);
    if (oldFile && oldFile !== newFileName) {
      try {
        await this.fs.delete(this.getFlowUri(oldFile));
      } catch {
        // ignore - old file may not exist
      }
    }
    const uri = this.getFlowUri(newFileName);
    const content = new TextEncoder().encode(JSON.stringify(flow, null, 2));
    await this.fs.writeFile(uri, content);
  }

  async load(flowId: string): Promise<FlowDefinition> {
    validateFlowId(flowId);
    const fileName = await this.findFlowFile(flowId);
    if (!fileName) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    const uri = this.getFlowUri(fileName);
    const data = await this.fs.readFile(uri);
    return JSON.parse(new TextDecoder().decode(data)) as FlowDefinition;
  }

  async delete(flowId: string): Promise<void> {
    validateFlowId(flowId);
    const fileName = await this.findFlowFile(flowId);
    if (!fileName) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    await this.fs.delete(this.getFlowUri(fileName));
  }

  async list(): Promise<FlowSummary[]> {
    const baseDir = this.getBaseDir();
    let entries: [string, number][];
    try {
      entries = await this.fs.readDirectory(baseDir);
    } catch {
      // .flowrunner ディレクトリが未作成（初回起動時）
      return [];
    }
    const flows: FlowDefinition[] = [];
    for (const [name] of entries) {
      if (!name.endsWith(".json")) continue;
      try {
        const uri = this.getFlowUri(name);
        const data = await this.fs.readFile(uri);
        flows.push(JSON.parse(new TextDecoder().decode(data)) as FlowDefinition);
      } catch {
        // 個別ファイルのパースエラーをスキップし、他のフローの表示を妨げない
        console.warn(`[FlowRepository] Failed to load: ${name}`);
      }
    }
    flows.sort((a, b) => a.name.localeCompare(b.name));
    return flows.map((f) => ({
      id: f.id,
      name: f.name,
      updatedAt: f.updatedAt,
    }));
  }

  async exists(flowId: string): Promise<boolean> {
    validateFlowId(flowId);
    const fileName = await this.findFlowFile(flowId);
    return fileName !== undefined;
  }
}
