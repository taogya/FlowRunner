// Trace: FEAT-00004-003001, FEAT-00004-003002
import type { NodeInstance, EdgeInstance } from "@shared/types/flow.js";

/**
 * フローテンプレート定義
 */
export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: "builtin" | "user";
  nodes: NodeInstance[];
  edges: EdgeInstance[];
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
