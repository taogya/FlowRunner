# FEAT-00003: Chat Participant (@flowrunner)

- 対応する RD 参照: RD-01 §10 #3（Copilot Chat から FlowRunner を操作。ターミナル履歴からのフロー自動生成を含む）

> 2026-04-04 追記: 本機能は REV-020 により廃止した。理由は、VS Code 非公開 API `terminal.shellIntegration.history` に依存していたこと、および LLM による構造化 JSON 生成の品質を保証できないことによる。本書は履歴記録として保持する。

## 概要

VS Code の Chat Participant API を利用して `@flowrunner` チャットパーティシパントを実装する。ユーザーは Copilot Chat から自然言語でフローの実行・一覧取得・作成を行える。ターミナル履歴を利用したフロー自動生成もサポートする。

## スコープ (FEAT-00003-002000)

### 実装する範囲

- `@flowrunner` Chat Participant 登録（package.json + request handler）
- スラッシュコマンド: `/run`, `/list`, `/create`
- `/run`: フロー名またはIDを指定して実行し、結果をチャットに返す
- `/list`: 登録済みフロー一覧をチャットに返す
- `/create`: ターミナル履歴または自然言語プロンプトからフローを生成
- IFlowService / IExecutionService との統合
- Language Model API を使ったコマンド処理・フロー生成
- participant detection（disambiguation）による自動ルーティング

### スコープ外

- フローの WebView エディタを Chat から直接開く操作（既存コマンドへのボタン誘導のみ）
- `/debug` コマンド（将来拡張）
- フロー実行のリアルタイムストリーミング進捗（完了後の結果表示のみ）
- ターミナル履歴の永続化

## 仕様

### §3.1 Chat Participant 登録 (FEAT-00003-003001)

package.json の `contributes.chatParticipants` に登録する:

```json
{
  "id": "flowrunner.flowrunner",
  "name": "flowrunner",
  "fullName": "FlowRunner",
  "description": "Run, list, and create FlowRunner flows",
  "isSticky": false,
  "commands": [
    { "name": "run", "description": "Execute a flow by name" },
    { "name": "list", "description": "List available flows" },
    { "name": "create", "description": "Create a new flow from description or terminal history" }
  ],
  "disambiguation": [
    {
      "category": "flowrunner",
      "description": "The user wants to run, list, or create automation flows using FlowRunner",
      "examples": [
        "Run the deployment flow",
        "Show me all my flows",
        "Create a flow that builds and tests my project",
        "Make a workflow from my terminal history"
      ]
    }
  ]
}
```

### §3.2 ChatParticipantHandler (FEAT-00003-003002)

`src/extension/chat/ChatParticipantHandler.ts` に request handler を実装する。

```typescript
export class ChatParticipantHandler {
  constructor(
    private readonly flowService: IFlowService,
    private readonly executionService: IExecutionService,
  ) {}

  async handle(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> { ... }
}
```

- コマンド別にディスパッチ:
  - `request.command === 'run'` → `handleRun()`
  - `request.command === 'list'` → `handleList()`
  - `request.command === 'create'` → `handleCreate()`
  - コマンドなし → LLM によるインテント判定、または使い方ガイドを返す

### §3.3 /run コマンド (FEAT-00003-003003)

- `request.prompt` からフロー名（またはID）を取得
- `flowService.listFlows()` から該当フローを検索（部分一致対応）
- 一致するフローが見つかれば `executionService.executeFlow(flowId)` を実行
- 実行結果（成功/失敗、ノード結果サマリー）をマークダウンで `stream.markdown()` に出力
- フローが見つからない場合はエラーメッセージと候補を提示

### §3.4 /list コマンド (FEAT-00003-003004)

- `flowService.listFlows()` で全フローを取得
- フロー名・ID・ノード数をテーブル形式で `stream.markdown()` に出力
- フローが存在しない場合は作成を提案するフォローアップを返す

### §3.5 /create コマンド (FEAT-00003-003005)

- `request.prompt` を解析:
  - 「ターミナル履歴から」「terminal history」を含む場合 → ターミナル履歴ベース生成
  - それ以外 → 自然言語プロンプトベース生成
- Language Model API (`request.model`) を使用してフロー定義 JSON を生成
  - システムプロンプトに FlowRunner のノード種別・スキーマ情報を含める
  - LLM の応答を FlowDefinition として parse
- 生成されたフローを `flowService.createFlow()` で保存
- 結果をマークダウン + 「エディタで開く」ボタンで表示

ターミナル履歴取得:
- `vscode.window.terminals` から最新のターミナルを取得
- `terminal.shellIntegration?.history` からコマンド履歴を取得（利用可能な場合）
- 利用不可の場合はユーザーに手動入力を促す

### §3.6 extensionMain.ts 統合 (FEAT-00003-003006)

- `vscode.chat.createChatParticipant()` で participant を登録
- `context.subscriptions` に追加して破棄管理
- `ChatParticipantHandler` に既存サービスインスタンスを DI

### §3.7 フォローアップ提案 (FEAT-00003-003007)

各コマンドの応答後にフォローアップを提供:
- `/run` 完了後: 「もう一度実行」「別のフローを実行」
- `/list` 完了後: 「フローを実行」「新しいフローを作成」
- `/create` 完了後: 「作成したフローを実行」「エディタで編集」

## 影響範囲 (FEAT-00003-004000)

| コンポーネント | 変更内容 | 影響度 |
|---|---|---|
| package.json | chatParticipants 追加 | 低 |
| extensionMain.ts | participant 登録 | 低 |
| ChatParticipantHandler (新規) | request handler | 新規 |

## テスト方針 (FEAT-00003-005000)

- **ユニットテスト**: ChatParticipantHandler のコマンドディスパッチ、各コマンドのロジック
- vscode.chat API は mock 化（ChatRequest, ChatResponseStream の mock）
- Language Model API は mock 化（/create テスト）

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00003-003001 | Chat Participant 登録 | FEAT-00003-003001-00001 | package.json に chatParticipants 定義がある | ✅ |
| FEAT-00003-003002 | ChatParticipantHandler | FEAT-00003-003002-00001 | コマンド別にディスパッチされる | ✅ |
| FEAT-00003-003002 | ChatParticipantHandler | FEAT-00003-003002-00002 | コマンドなしで使い方ガイドを返す | ✅ |
| FEAT-00003-003003 | /run コマンド | FEAT-00003-003003-00001 | フロー名指定で実行し結果を返す | ✅ |
| FEAT-00003-003003 | /run コマンド | FEAT-00003-003003-00002 | フロー未検出時にエラーと候補を返す | ✅ |
| FEAT-00003-003004 | /list コマンド | FEAT-00003-003004-00001 | 全フロー一覧をテーブル形式で返す | ✅ |
| FEAT-00003-003004 | /list コマンド | FEAT-00003-003004-00002 | フローなし時に作成提案を返す | ✅ |
| FEAT-00003-003005 | /create コマンド | FEAT-00003-003005-00001 | 自然言語プロンプトからフローを生成する | ✅ |
| FEAT-00003-003005 | /create コマンド | FEAT-00003-003005-00002 | ターミナル履歴ベースでフローを生成する | ☐ |
| FEAT-00003-003005 | /create コマンド | FEAT-00003-003005-00003 | LLM 応答の JSON parse 失敗時にエラーを返す | ✅ |
| FEAT-00003-003006 | extensionMain.ts 統合 | FEAT-00003-003006-00001 | participant が context.subscriptions に登録される | ✅ |
| FEAT-00003-003007 | フォローアップ | FEAT-00003-003007-00001 | 各コマンド後にフォローアップが提案される | ✅ |
