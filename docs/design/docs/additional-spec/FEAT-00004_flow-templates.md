# FEAT-00004: フローテンプレート

- 対応する RD 参照: RD-01 §10 #4（定型フローの雛形を提供）

## 概要

定型フローの雛形（テンプレート）を提供し、新規ユーザーが典型的なフローパターンを素早く作成できるようにする。ビルトインテンプレート（拡張機能に同梱）とユーザー定義テンプレート（ワークスペース内保存）の2種類をサポートする。

## スコープ (FEAT-00004-002000)

### 実装する範囲

- ビルトインテンプレート 5種（Hello World, 条件分岐, カウントループ, HTTP API, ファイル操作）
- ユーザー定義テンプレート（`.flowrunner/templates/` に保存）
- `flowrunner.createFlowFromTemplate` コマンド + QuickPick UI
- `flowrunner.saveAsTemplate` コマンド（既存フローをテンプレート化）
- package.json コマンド登録、NLS ラベル

### スコープ外

- WebView 上のテンプレートギャラリー UI（QuickPick のみ対応）
- テンプレートのバージョン管理
- テンプレートの共有・エクスポート

## 仕様

### §3.1 テンプレートデータ構造 (FEAT-00004-003001)

テンプレートは以下の構造を持つ:

```typescript
interface FlowTemplate {
  id: string;           // テンプレートID
  name: string;         // テンプレート名
  description: string;  // 説明（QuickPickの詳細行に表示）
  category: "builtin" | "user";
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
}
```

- ビルトインテンプレートは拡張機能コード内に定義（`src/extension/templates/builtinTemplates.ts`）
- ユーザーテンプレートは `.flowrunner/templates/<name>_<shortId>.json` に保存

### §3.2 ビルトインテンプレート一覧 (FEAT-00004-003002)

| ID | 名前 | 説明 | ノード構成 |
|---|---|---|---|
| builtin-hello | Hello World | Trigger → Command → Log の基本チェーン | trigger, command(echo), log |
| builtin-condition | 条件分岐パターン | Trigger → Condition → Log (true/false) | trigger, condition, log×2 |
| builtin-loop | カウントループ | Trigger → Loop(count=3) → Command → Log | trigger, loop, command, log |
| builtin-http | HTTP API 呼び出し | Trigger → HTTP(GET) → Transform → Log | trigger, http, transform(jsonParse), log |
| builtin-file | ファイル操作 | Trigger → File(read) → Log | trigger, file(read), log |

### §3.3 createFlowFromTemplate コマンド (FEAT-00004-003003)

1. QuickPick でテンプレート一覧を表示（ビルトイン + ユーザー）
2. ユーザーがテンプレートを選択
3. フロー名の入力ダイアログを表示
4. テンプレートのノード/エッジをコピーして新規フローを作成
5. 各ノードに新しい UUID を割り当て（ID衝突防止）
6. エディタで自動的に開く

### §3.4 saveAsTemplate コマンド (FEAT-00004-003004)

1. フロー一覧から保存対象を選択（QuickPick）
2. テンプレート名を入力
3. 選択フローのノード/エッジを `.flowrunner/templates/` に保存
4. テンプレートIDは `user-<uuid>` 形式

### §3.5 CommandRegistry 統合 (FEAT-00004-003005)

- `CommandRegistry.registerAll()` に2コマンドを追加
- 既存の `handleCreateFlow` パターンに従う

### §3.6 package.json 登録 (FEAT-00004-003006)

- `contributes.commands` に2コマンドを追加
- `contributes.menus.view/title` にテンプレート作成ボタンを追加

## 影響範囲 (FEAT-00004-004000)

| コンポーネント | 変更内容 | 影響度 |
|---|---|---|
| package.json | コマンド追加 | 低 |
| CommandRegistry.ts | ハンドラー追加 | 低 |
| builtinTemplates.ts (新規) | ビルトインテンプレート定義 | 新規 |
| .flowrunner/templates/ | ユーザーテンプレート保存先 | 新規 |

## テスト方針 (FEAT-00004-005000)

- ビルトインテンプレート定義の構造検証
- テンプレートからの新規フロー作成ロジック
- ユーザーテンプレート保存・読み込み
- vscode API (showQuickPick, showInputBox) はモック化

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00004-003001 | データ構造 | FEAT-00004-003001-00001 | ビルトインテンプレートが有効な構造を持つ | ✅ |
| FEAT-00004-003002 | ビルトイン一覧 | FEAT-00004-003002-00001 | 5種のビルトインテンプレートが定義されている | ✅ |
| FEAT-00004-003003 | createFromTemplate | FEAT-00004-003003-00001 | テンプレート選択→フロー名入力→フロー生成 | ✅ |
| FEAT-00004-003003 | createFromTemplate | FEAT-00004-003003-00002 | ノードIDが新規UUIDで再割り当てされる | ✅ |
| FEAT-00004-003003 | createFromTemplate | FEAT-00004-003003-00003 | キャンセル時にフローが作成されない | ✅ |
| FEAT-00004-003004 | saveAsTemplate | FEAT-00004-003004-00001 | 既存フローをテンプレートとして保存できる | ✅ |
| FEAT-00004-003004 | saveAsTemplate | FEAT-00004-003004-00002 | ユーザーテンプレートがQuickPickに表示される | ✅ |
| FEAT-00004-003005 | CommandRegistry | FEAT-00004-003005-00001 | 2コマンドが登録されている | ✅ |
| FEAT-00004-003006 | package.json | FEAT-00004-003006-00001 | package.json にコマンド定義がある | ✅ |
