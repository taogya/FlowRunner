// Trace: FEAT-00004-003001, FEAT-00004-003002
import type { NodeInstance, EdgeInstance } from "@shared/types/flow.js";

export type TemplateDifficulty = "beginner" | "intermediate";

/**
 * フローテンプレート定義
 */
export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: "builtin" | "user";
  isStarter?: boolean;
  difficulty?: TemplateDifficulty;
  recommendedUseCase?: string;
  tags?: string[];
  nodes: NodeInstance[];
  edges: EdgeInstance[];
}

function createCommentNode(
  id: string,
  label: string,
  comment: string,
  x: number,
  y: number,
): NodeInstance {
  return {
    id,
    type: "comment",
    label,
    enabled: true,
    position: { x, y },
    settings: { comment },
  };
}

function createStarterTemplate(
  template: Omit<FlowTemplate, "category" | "isStarter">,
): FlowTemplate {
  return {
    ...template,
    category: "builtin",
    isStarter: true,
  };
}

// Trace: FEAT-00004-003002
export const builtinTemplates: FlowTemplate[] = [
  {
    id: "builtin-hello",
    name: "Hello World",
    description: "Trigger → Command → Log の基本チェーン",
    category: "builtin",
    nodes: [
      { id: "trigger", type: "trigger", label: "Trigger", enabled: true, position: { x: 100, y: 100 }, settings: { triggerType: "manual" } },
      { id: "cmd", type: "command", label: "Echo Hello", enabled: true, position: { x: 350, y: 100 }, settings: { command: "echo Hello, FlowRunner!" } },
      { id: "log", type: "log", label: "Output Log", enabled: true, position: { x: 600, y: 100 }, settings: { level: "info" } },
    ],
    edges: [
      { id: "e1", sourceNodeId: "trigger", sourcePortId: "out", targetNodeId: "cmd", targetPortId: "in" },
      { id: "e2", sourceNodeId: "cmd", sourcePortId: "stdout", targetNodeId: "log", targetPortId: "in" },
    ],
  },
  {
    id: "builtin-condition",
    name: "条件分岐パターン",
    description: "Trigger → Condition → Log (true/false 分岐)",
    category: "builtin",
    nodes: [
      { id: "trigger", type: "trigger", label: "Trigger", enabled: true, position: { x: 100, y: 200 }, settings: { triggerType: "manual" } },
      { id: "cond", type: "condition", label: "条件分岐", enabled: true, position: { x: 350, y: 200 }, settings: { expression: "input == true" } },
      { id: "log-true", type: "log", label: "True 分岐", enabled: true, position: { x: 600, y: 100 }, settings: { level: "info" } },
      { id: "log-false", type: "log", label: "False 分岐", enabled: true, position: { x: 600, y: 300 }, settings: { level: "warn" } },
    ],
    edges: [
      { id: "e1", sourceNodeId: "trigger", sourcePortId: "out", targetNodeId: "cond", targetPortId: "in" },
      { id: "e2", sourceNodeId: "cond", sourcePortId: "true", targetNodeId: "log-true", targetPortId: "in" },
      { id: "e3", sourceNodeId: "cond", sourcePortId: "false", targetNodeId: "log-false", targetPortId: "in" },
    ],
  },
  {
    id: "builtin-loop",
    name: "カウントループ",
    description: "Trigger → Loop(count=3) → Command → Log",
    category: "builtin",
    nodes: [
      { id: "trigger", type: "trigger", label: "Trigger", enabled: true, position: { x: 100, y: 150 }, settings: { triggerType: "manual" } },
      { id: "loop", type: "loop", label: "3回ループ", enabled: true, position: { x: 350, y: 150 }, settings: { loopType: "count", count: 3 } },
      { id: "cmd", type: "command", label: "Echo Iteration", enabled: true, position: { x: 600, y: 100 }, settings: { command: "echo Iteration: {{input}}" } },
      { id: "log", type: "log", label: "完了ログ", enabled: true, position: { x: 600, y: 250 }, settings: { level: "info" } },
    ],
    edges: [
      { id: "e1", sourceNodeId: "trigger", sourcePortId: "out", targetNodeId: "loop", targetPortId: "in" },
      { id: "e2", sourceNodeId: "loop", sourcePortId: "body", targetNodeId: "cmd", targetPortId: "in" },
      { id: "e3", sourceNodeId: "loop", sourcePortId: "done", targetNodeId: "log", targetPortId: "in" },
    ],
  },
  {
    id: "builtin-http",
    name: "HTTP API 呼び出し",
    description: "Trigger → HTTP(GET) → Transform(jsonParse) → Log",
    category: "builtin",
    nodes: [
      { id: "trigger", type: "trigger", label: "Trigger", enabled: true, position: { x: 100, y: 100 }, settings: { triggerType: "manual" } },
      { id: "http", type: "http", label: "HTTP GET", enabled: true, position: { x: 350, y: 100 }, settings: { method: "GET", url: "https://httpbin.org/get" } },
      { id: "parse", type: "transform", label: "JSON Parse", enabled: true, position: { x: 600, y: 100 }, settings: { transformType: "jsonParse" } },
      { id: "log", type: "log", label: "Response Log", enabled: true, position: { x: 850, y: 100 }, settings: { level: "info" } },
    ],
    edges: [
      { id: "e1", sourceNodeId: "trigger", sourcePortId: "out", targetNodeId: "http", targetPortId: "in" },
      { id: "e2", sourceNodeId: "http", sourcePortId: "body", targetNodeId: "parse", targetPortId: "in" },
      { id: "e3", sourceNodeId: "parse", sourcePortId: "out", targetNodeId: "log", targetPortId: "in" },
    ],
  },
  {
    id: "builtin-file",
    name: "ファイル操作",
    description: "Trigger → File(read) → Log でファイル読み取り",
    category: "builtin",
    nodes: [
      { id: "trigger", type: "trigger", label: "Trigger", enabled: true, position: { x: 100, y: 100 }, settings: { triggerType: "manual" } },
      { id: "file", type: "file", label: "File Read", enabled: true, position: { x: 350, y: 100 }, settings: { operation: "read", filePath: "./README.md" } },
      { id: "log", type: "log", label: "File Content", enabled: true, position: { x: 600, y: 100 }, settings: { level: "info" } },
    ],
    edges: [
      { id: "e1", sourceNodeId: "trigger", sourcePortId: "out", targetNodeId: "file", targetPortId: "in" },
      { id: "e2", sourceNodeId: "file", sourcePortId: "out", targetNodeId: "log", targetPortId: "in" },
    ],
  },
];

// Trace: FEAT-00014-003001, FEAT-00014-003004
export const starterTemplates: FlowTemplate[] = [
  createStarterTemplate({
    id: "starter-command-runner",
    name: "コマンド実行スターター",
    description: "最初の 1 本として使いやすい Trigger → Command → Log",
    difficulty: "beginner",
    recommendedUseCase: "CLI コマンドを 1 つ実行して結果を確認したいとき",
    tags: ["command", "starter", "log"],
    nodes: [
      createCommentNode(
        "guide-start",
        "はじめに",
        "1. Command ノードの command を自分のコマンドへ変更します。",
        80,
        20,
      ),
      createCommentNode(
        "guide-check",
        "確認ポイント",
        "2. 実行後は Log ノードを選択して stdout を確認します。",
        620,
        20,
      ),
      {
        id: "trigger",
        type: "trigger",
        label: "Trigger",
        enabled: true,
        position: { x: 100, y: 140 },
        settings: { triggerType: "manual" },
      },
      {
        id: "command",
        type: "command",
        label: "Run Command",
        enabled: true,
        position: { x: 360, y: 140 },
        settings: { command: "echo Hello from FlowRunner" },
      },
      {
        id: "log",
        type: "log",
        label: "Check Result",
        enabled: true,
        position: { x: 620, y: 140 },
        settings: { level: "info" },
      },
    ],
    edges: [
      {
        id: "e1",
        sourceNodeId: "trigger",
        sourcePortId: "out",
        targetNodeId: "command",
        targetPortId: "in",
      },
      {
        id: "e2",
        sourceNodeId: "command",
        sourcePortId: "stdout",
        targetNodeId: "log",
        targetPortId: "in",
      },
    ],
  }),
  createStarterTemplate({
    id: "starter-file-reader",
    name: "ファイル読み取りスターター",
    description: "ローカルファイルを読み込んで内容を確認する基本形",
    difficulty: "beginner",
    recommendedUseCase: "README や設定ファイルを読み込んで確認したいとき",
    tags: ["file", "starter", "read"],
    nodes: [
      createCommentNode(
        "guide-path",
        "最初に編集",
        "1. File ノードの path を読みたいファイルへ変更します。",
        80,
        20,
      ),
      createCommentNode(
        "guide-output",
        "結果確認",
        "2. Log ノードで読み取った内容を確認します。",
        620,
        20,
      ),
      {
        id: "trigger",
        type: "trigger",
        label: "Trigger",
        enabled: true,
        position: { x: 100, y: 140 },
        settings: { triggerType: "manual" },
      },
      {
        id: "file",
        type: "file",
        label: "Read File",
        enabled: true,
        position: { x: 360, y: 140 },
        settings: { operation: "read", path: "./README.md" },
      },
      {
        id: "log",
        type: "log",
        label: "File Content",
        enabled: true,
        position: { x: 620, y: 140 },
        settings: { level: "info" },
      },
    ],
    edges: [
      {
        id: "e1",
        sourceNodeId: "trigger",
        sourcePortId: "out",
        targetNodeId: "file",
        targetPortId: "in",
      },
      {
        id: "e2",
        sourceNodeId: "file",
        sourcePortId: "out",
        targetNodeId: "log",
        targetPortId: "in",
      },
    ],
  }),
  createStarterTemplate({
    id: "starter-api-checker",
    name: "API 疎通確認スターター",
    description: "HTTP GET で API の応答を確認するスターター",
    difficulty: "beginner",
    recommendedUseCase: "API のレスポンスやステータスをまず確認したいとき",
    tags: ["http", "starter", "api"],
    nodes: [
      createCommentNode(
        "guide-url",
        "URL を変更",
        "1. HTTP ノードの URL を確認したいエンドポイントへ変更します。",
        80,
        20,
      ),
      createCommentNode(
        "guide-api-log",
        "見る場所",
        "2. Log ノードでレスポンス本文を確認し、必要なら次に Transform を追加します。",
        640,
        20,
      ),
      {
        id: "trigger",
        type: "trigger",
        label: "Trigger",
        enabled: true,
        position: { x: 100, y: 140 },
        settings: { triggerType: "manual" },
      },
      {
        id: "http",
        type: "http",
        label: "HTTP GET",
        enabled: true,
        position: { x: 360, y: 140 },
        settings: { method: "GET", url: "https://httpbin.org/get" },
      },
      {
        id: "log",
        type: "log",
        label: "Response Body",
        enabled: true,
        position: { x: 640, y: 140 },
        settings: { level: "info" },
      },
    ],
    edges: [
      {
        id: "e1",
        sourceNodeId: "trigger",
        sourcePortId: "out",
        targetNodeId: "http",
        targetPortId: "in",
      },
      {
        id: "e2",
        sourceNodeId: "http",
        sourcePortId: "body",
        targetNodeId: "log",
        targetPortId: "in",
      },
    ],
  }),
  createStarterTemplate({
    id: "starter-scheduled-cleanup",
    name: "定期実行スターター",
    description: "schedule trigger を使って定期処理の形を作るスターター",
    difficulty: "intermediate",
    recommendedUseCase: "定期実行フローの雛形を作ってあとからコマンドを差し替えたいとき",
    tags: ["trigger", "schedule", "starter"],
    nodes: [
      createCommentNode(
        "guide-schedule",
        "まず設定",
        "1. Trigger の intervalSeconds を実行間隔に合わせて変更します。",
        80,
        20,
      ),
      createCommentNode(
        "guide-activate",
        "実行方法",
        "2. 保存後に FlowRunner: トリガーを有効化 で定期実行を開始します。",
        360,
        20,
      ),
      createCommentNode(
        "guide-schedule-output",
        "確認ポイント",
        "3. Log ノードで定期実行の結果を確認します。",
        660,
        20,
      ),
      {
        id: "trigger",
        type: "trigger",
        label: "Scheduled Trigger",
        enabled: true,
        position: { x: 100, y: 160 },
        settings: { triggerType: "schedule", intervalSeconds: 3600 },
      },
      {
        id: "command",
        type: "command",
        label: "Run Cleanup",
        enabled: true,
        position: { x: 380, y: 160 },
        settings: { command: "echo cleanup job" },
      },
      {
        id: "log",
        type: "log",
        label: "Cleanup Result",
        enabled: true,
        position: { x: 660, y: 160 },
        settings: { level: "info" },
      },
    ],
    edges: [
      {
        id: "e1",
        sourceNodeId: "trigger",
        sourcePortId: "out",
        targetNodeId: "command",
        targetPortId: "in",
      },
      {
        id: "e2",
        sourceNodeId: "command",
        sourcePortId: "stdout",
        targetNodeId: "log",
        targetPortId: "in",
      },
    ],
  }),
  createStarterTemplate({
    id: "starter-error-handling",
    name: "エラーハンドリングスターター",
    description: "TryCatch で失敗時の分岐を先に用意するスターター",
    difficulty: "intermediate",
    recommendedUseCase: "失敗時の通知や分岐を意識したフローを最初から組みたいとき",
    tags: ["tryCatch", "starter", "error"],
    nodes: [
      createCommentNode(
        "guide-try",
        "Try 側",
        "1. Try 側の File ノードを、本番で実行したいノードへ差し替えます。",
        80,
        20,
      ),
      createCommentNode(
        "guide-catch",
        "Catch 側",
        "2. Catch 側には失敗通知や代替処理をつなぎます。",
        620,
        20,
      ),
      {
        id: "trigger",
        type: "trigger",
        label: "Trigger",
        enabled: true,
        position: { x: 100, y: 170 },
        settings: { triggerType: "manual" },
      },
      {
        id: "tryCatch",
        type: "tryCatch",
        label: "Try / Catch",
        enabled: true,
        position: { x: 360, y: 170 },
        settings: {},
      },
      {
        id: "file",
        type: "file",
        label: "Risky Step",
        enabled: true,
        position: { x: 620, y: 120 },
        settings: { operation: "read", path: "./missing.txt" },
      },
      {
        id: "catchLog",
        type: "log",
        label: "Handle Error",
        enabled: true,
        position: { x: 620, y: 250 },
        settings: { level: "warn" },
      },
      {
        id: "doneLog",
        type: "log",
        label: "Done",
        enabled: true,
        position: { x: 900, y: 170 },
        settings: { level: "info" },
      },
    ],
    edges: [
      {
        id: "e1",
        sourceNodeId: "trigger",
        sourcePortId: "out",
        targetNodeId: "tryCatch",
        targetPortId: "in",
      },
      {
        id: "e2",
        sourceNodeId: "tryCatch",
        sourcePortId: "try",
        targetNodeId: "file",
        targetPortId: "in",
      },
      {
        id: "e3",
        sourceNodeId: "tryCatch",
        sourcePortId: "catch",
        targetNodeId: "catchLog",
        targetPortId: "in",
      },
      {
        id: "e4",
        sourceNodeId: "tryCatch",
        sourcePortId: "done",
        targetNodeId: "doneLog",
        targetPortId: "in",
      },
    ],
  }),
];
