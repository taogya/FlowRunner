# FEAT-00006: エラーハンドリングノード

- 対応する RD 参照: RD-01 §10 #7（try/catch 的なエラー処理パス定義）

## 概要

try/catch 的なエラーハンドリングを実現する `tryCatch` ノードを追加する。LoopExecutor と同様のサブグラフ実行パターンを採用し、try 本体の実行失敗時に catch パスへフォールバックする。

## スコープ (FEAT-00006-002000)

### 実装する範囲

- `tryCatch` ノード種別と `TryCatchExecutor`
- ExecutionService での tryCatch サブグラフ実行ロジック
- executionHelpers に `findTryCatchNodes` ヘルパー追加
- registerBuiltinExecutors への登録
- NLS ラベル

### スコープ外

- ネストされた tryCatch（動作するが公式サポート外）
- retry ロジック
- WebView の特別な tryCatch 表示

## 仕様

### §3.1 TryCatchExecutor (FEAT-00006-003001)

```typescript
// ポート定義
inputPorts: [{ id: "in", label: "入力", dataType: "any" }]
outputPorts: [
  { id: "try", label: "Try 本体", dataType: "any" },
  { id: "catch", label: "Catch", dataType: "any" },
  { id: "done", label: "完了", dataType: "any" },
]
```

- execute(): 入力をそのまま `try` ポートに出力。ExecutionService が try サブグラフを実行
- try 成功時: `done` ポートに try の結果を出力
- try 失敗時: ExecutionService が catch サブグラフを実行し、`done` ポートに catch の結果を出力

### §3.2 executionHelpers 拡張 (FEAT-00006-003002)

`findTryCatchNodes(nodeId, edges)` を追加:
- `try` ポートから到達可能で `done` / `catch` から到達不能 → try 本体ノード
- `catch` ポートから到達可能で `done` / `try` から到達不能 → catch ノード
- `findBodyNodes` と同じ BFS アルゴリズム

### §3.3 ExecutionService 統合 (FEAT-00006-003003)

Loop の `executeLoopBody` パターンに準じた `executeTryCatch` メソッドを追加:
1. try ノードを特定 (`findTryCatchNodes`)
2. try ノードをトポロジカル順に実行
3. エラー発生時: catch ノードを特定・実行（エラー情報を `catch` ポートに渡す）
4. 全体の結果を `done` ポートに出力

### §3.4 registerBuiltinExecutors (FEAT-00006-003004)

- `registry.register("tryCatch", new TryCatchExecutor())` を追加

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00006-003001 | TryCatchExecutor | FEAT-00006-003001-00001 | try ポートに入力を出力する | ☑ |
| FEAT-00006-003001 | TryCatchExecutor | FEAT-00006-003001-00002 | validate が正常に通過する | ☑ |
| FEAT-00006-003001 | TryCatchExecutor | FEAT-00006-003001-00003 | metadata が正しいポート構成を持つ | ☑ |
| FEAT-00006-003002 | executionHelpers | FEAT-00006-003002-00001 | findTryCatchNodes が正しく try/catch ノードを分類する | ☑ |
| FEAT-00006-003003 | ExecutionService | FEAT-00006-003003-00001 | try 成功時に catch をスキップして done に到達する | ☑ |
| FEAT-00006-003003 | ExecutionService | FEAT-00006-003003-00002 | try 失敗時に catch パスが実行される | ☑ |
| FEAT-00006-003004 | 登録 | FEAT-00006-003004-00001 | tryCatch が NodeExecutorRegistry に登録されている | ☑ |
| FEAT-00006-003003 | ExecutionService (ST) | FEAT-00006-003003-00010 | tryCatch ノードが try パスを正常実行する (e2e) | ☑ |
