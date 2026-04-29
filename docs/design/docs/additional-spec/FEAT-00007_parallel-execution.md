# FEAT-00007: 並列実行

- 対応する RD 参照: RD-01 §10 #8（分岐後の複数パスを同時実行）

## 概要

並列実行ノード (`parallel`) を追加し、分岐後の複数パスを `Promise.all` で同時実行する。TryCatch/Loop と同様のサブグラフ実行パターンを採用する。

## スコープ (FEAT-00007-002000)

### 実装する範囲

- `parallel` ノード種別と `ParallelExecutor`
- ExecutionService での並列サブグラフ実行ロジック
- executionHelpers に `findParallelBranches` ヘルパー追加
- registerBuiltinExecutors への登録

### スコープ外

- 動的な分岐数（固定 3 ブランチまで）
- 並列ブランチ間の変数共有（各ブランチは独立実行）
- WebView の特別な並列表示

## 仕様

### §3.1 ParallelExecutor (FEAT-00007-003001)

```typescript
// ポート定義
inputPorts: [{ id: "in", label: "入力", dataType: "any" }]
outputPorts: [
  { id: "branch1", label: "ブランチ1", dataType: "any" },
  { id: "branch2", label: "ブランチ2", dataType: "any" },
  { id: "branch3", label: "ブランチ3", dataType: "any" },
  { id: "done", label: "完了", dataType: "any" },
]
```

- execute(): 入力をすべてのブランチポートに出力
- ExecutionService が各ブランチのサブグラフを `Promise.all` で同時実行
- 全ブランチ完了後に `done` ポートに結果を出力

### §3.2 executionHelpers 拡張 (FEAT-00007-003002)

`findParallelBranches(nodeId, edges)` を追加:
- `branch1` / `branch2` / `branch3` ポートから到達可能で `done` から到達不能 → 各ブランチノード
- 未接続ブランチは空配列

### §3.3 ExecutionService 統合 (FEAT-00007-003003)

`executeParallel` メソッドを追加:
1. 各ブランチのノードを特定 (`findParallelBranches`)
2. `Promise.all` で全ブランチを同時実行
3. いずれかのブランチでエラー → 他ブランチは中断しないが、エラー情報を done に含める
4. 全結果を `done` ポートに集約

### §3.4 registerBuiltinExecutors (FEAT-00007-003004)

- `registry.register("parallel", new ParallelExecutor())` を追加

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00007-003001 | ParallelExecutor | FEAT-00007-003001-00001 | 全ブランチポートに入力を出力する | ✅ |
| FEAT-00007-003001 | ParallelExecutor | FEAT-00007-003001-00002 | metadata が正しいポート構成を持つ | ✅ |
| FEAT-00007-003002 | executionHelpers | FEAT-00007-003002-00001 | findParallelBranches が正しくブランチノードを分類する | ✅ |
| FEAT-00007-003003 | ExecutionService | FEAT-00007-003003-00001 | 全ブランチが並列実行される | ✅ |
| FEAT-00007-003004 | 登録 | FEAT-00007-003004-00001 | parallel が NodeExecutorRegistry に登録されている | ✅ |
| FEAT-00007-003003 | ExecutionService (ST) | FEAT-00007-003003-00010 | parallel ノードが全ブランチを実行する (e2e) | ✅ |
| FEAT-00007-003003 | ExecutionService (ST) | FEAT-00007-003003-00011 | 未接続ブランチがあっても正常動作する (e2e) | ✅ |
