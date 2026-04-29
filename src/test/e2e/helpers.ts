// ST テスト共通ヘルパー
import * as fs from "fs";
import * as path from "path";

// FlowRepository / HistoryRepository と同じ命名規則
function sanitizeName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "flow";
}

function buildFlowFileName(name: string, flowId: string): string {
  return `${sanitizeName(name)}_${flowId.slice(0, 8)}.json`;
}

/** .flowrunner/ ディレクトリ内で _<shortId>.json にマッチするファイルを検索 */
function findFlowFile(dir: string, flowId: string): string | undefined {
  const shortId = flowId.slice(0, 8);
  if (!fs.existsSync(dir)) {
    return undefined;
  }
  return fs.readdirSync(dir).find((f) => f.endsWith(`_${shortId}.json`));
}

/** .flowrunner/history/ 内で _<shortId> サフィックスのディレクトリを検索（旧形式フォールバック付き） */
function findHistoryDir(historyBase: string, flowId: string): string | undefined {
  const shortId = flowId.slice(0, 8);
  if (!fs.existsSync(historyBase)) {
    return undefined;
  }
  const entries = fs.readdirSync(historyBase, { withFileTypes: true });
  // 新形式: *_<shortId>
  const newFmt = entries.find((e) => e.isDirectory() && e.name.endsWith(`_${shortId}`));
  if (newFmt) {
    return path.join(historyBase, newFmt.name);
  }
  // 旧形式フォールバック: <flowId>
  const oldDir = path.join(historyBase, flowId);
  return fs.existsSync(oldDir) ? oldDir : undefined;
}

/** .flowrunner/ 内でフロー定義ファイルの絶対パスを返す（存在しなければ undefined） */
export function findFlowFilePath(workspaceRoot: string, flowId: string): string | undefined {
  const dir = path.join(workspaceRoot, ".flowrunner");
  const file = findFlowFile(dir, flowId);
  return file ? path.join(dir, file) : undefined;
}

/** .flowrunner/ ディレクトリにフロー定義 JSON を書き込む */
export function writeFlowFile(workspaceRoot: string, flow: FlowDef): void {
  const dir = path.join(workspaceRoot, ".flowrunner");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const fileName = buildFlowFileName(flow.name, flow.id);
  // 旧形式ファイルがあれば削除
  const oldFile = path.join(dir, `${flow.id}.json`);
  if (fs.existsSync(oldFile)) {
    fs.unlinkSync(oldFile);
  }
  fs.writeFileSync(
    path.join(dir, fileName),
    JSON.stringify(flow, null, 2),
  );
}

/** .flowrunner/ から flowId に対応するフローファイルを削除する */
export function removeFlowFile(workspaceRoot: string, flowId: string): void {
  const dir = path.join(workspaceRoot, ".flowrunner");
  const file = findFlowFile(dir, flowId);
  if (file) {
    fs.unlinkSync(path.join(dir, file));
  }
}

/** .flowrunner/history/ から flowId に対応する履歴 JSON を全件読み込む */
export function readHistoryRecords(
  workspaceRoot: string,
  flowId: string,
): unknown[] {
  const historyBase = path.join(workspaceRoot, ".flowrunner", "history");
  const dir = findHistoryDir(historyBase, flowId);
  if (!dir) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")));
}

/** .flowrunner/ 配下を全て削除する */
export function cleanupFlowrunnerDir(workspaceRoot: string): void {
  const dir = path.join(workspaceRoot, ".flowrunner");
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** ノード定義ヘルパー */
export function node(
  id: string,
  type: string,
  settings: Record<string, unknown> = {},
  opts: { enabled?: boolean; label?: string } = {},
): NodeDef {
  return {
    id,
    type,
    label: opts.label ?? type,
    enabled: opts.enabled ?? true,
    position: { x: 0, y: 0 },
    settings,
  };
}

/** エッジ定義ヘルパー */
export function edge(
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): EdgeDef {
  return { id, sourceNodeId, sourcePortId, targetNodeId, targetPortId };
}

/** フロー定義ヘルパー */
export function flow(
  id: string,
  name: string,
  nodes: NodeDef[],
  edges: EdgeDef[] = [],
): FlowDef {
  const now = new Date().toISOString();
  return {
    id,
    name,
    description: "",
    version: "1.0.0",
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// --- 型定義 (共有型を直接インポートしないため再宣言) ---

export interface NodeDef {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  position: { x: number; y: number };
  settings: Record<string, unknown>;
}

export interface EdgeDef {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

export interface FlowDef {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: NodeDef[];
  edges: EdgeDef[];
  createdAt: string;
  updatedAt: string;
}
