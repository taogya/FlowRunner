# FEAT-00011: サブフロー出力ノード選択

- 対応する REV 参照: REV-016 #12

## 概要

サブフローノードの設定に `outputNodeId` プルダウンを追加し、サブフロー内のどのノードの出力を使用するかをユーザーが明示的に選択できるようにする。サブフローの終端ノード（出力ポートが未接続のノード）を動的に検出してオプションとして表示する。未選択時は従来動作（最終実行ノードの出力）を維持する。

## スコープ

### 実装範囲

- SubFlowExecutor に `outputNodeId` 設定と `getMetadataAsync` メソッドの追加
- INodeExecutor インターフェースに `getMetadataAsync` オプショナルメソッドの追加
- ExecutionService.executeFlow に `outputNodeId` オプションの追加
- メッセージプロトコル `node:getMetadata` / `node:metadataLoaded` の追加
- WebView 側の `dynamicMetadata` 状態管理
- MessageBroker でのメタデータ解決ハンドラの追加

### スコープ外

- サブフロー内の中間ノード出力の選択（終端ノードのみ対象）
- サブフロー出力の複数ノード合成
- サブフロー実行のストリーミング出力

## 仕様

### §2.1 INodeExecutor インターフェース拡張 (FEAT-00011-002001)

INodeExecutor に `getMetadataAsync` オプショナルメソッドを追加:

| メソッド | 引数 | 戻り値 | 同期/非同期 | 用途 |
|---|---|---|---|---|
| `getMetadataAsync` | `currentSettings?: NodeSettings` | `Promise<INodeTypeMetadata>` | 非同期 | 設定値に依存する動的メタデータを返す |

- 既存の `getMetadata()` は静的メタデータを返す同期メソッドとして維持
- `getMetadataAsync` は必要なノードタイプのみが実装する（現在は SubFlow, AIPrompt）
- `currentSettings` パラメータにより、現在のフィールド値に基づくオプション生成が可能

**定義場所:** `src/extension/interfaces/INodeExecutor.ts`

### §2.2 SubFlowExecutor の動的メタデータ (FEAT-00011-002002)

SubFlowExecutor.getMetadataAsync の動作仕様:

1. `flowRepository.list()` で全フロー一覧を取得し、`flowId` の select オプションを生成
2. `currentSettings.flowId` が指定されている場合:
   a. `flowRepository.load(flowId)` で対象フローを読み込み
   b. `edges` から `sourceNodeId` の集合を構築
   c. sourceNodeId に含まれないノード = 終端ノード（出力ポートが未接続）として抽出
   d. 終端ノードの `id` と `label || type` を `outputNodeId` の select オプションとして生成
3. `currentSettings.flowId` が未指定の場合、`outputNodeId` のオプションは空配列

**settingsSchema:**

| key | label | type | required | description |
|---|---|---|---|---|
| `flowId` | フロー | `select` | `true` | 実行するサブフロー |
| `outputNodeId` | 出力ノード | `select` | `false` | サブフローの出力に使用するノード（未選択時は最終ノード） |

**定義場所:** `src/extension/executors/SubFlowExecutor.ts`

### §2.3 ExecutionService の出力ノード選択 (FEAT-00011-002003)

ExecutionService.executeFlow の `options` に `outputNodeId` パラメータを追加:

| パラメータ | 型 | デフォルト | 動作 |
|---|---|---|---|
| `outputNodeId` | `string \| undefined` | `undefined` | 指定時: `outputMap.get(outputNodeId)` を返却。未指定時: ソート済みノードの末尾から最初に出力を持つノードの結果を返却（従来動作） |

**定義場所:** `src/extension/services/ExecutionService.ts`

### §2.4 メッセージプロトコル (FEAT-00011-002004)

WebView ↔ Extension 間の動的メタデータ取得プロトコル:

| メッセージタイプ | 方向 | ペイロード | トリガー |
|---|---|---|---|
| `node:getMetadata` | WebView → Extension | `{ nodeType: string; settings: Record<string, unknown> }` | ノード選択時、settings 変更時 |
| `node:metadataLoaded` | Extension → WebView | `{ nodeType: string; metadata: INodeTypeMetadata }` | getMetadata の応答 |

**定義場所（型）:** `src/shared/types/messages.ts`

### §2.5 MessageBroker ハンドラ (FEAT-00011-002005)

MessageBroker に `node:getMetadata` ハンドラを追加:

1. `nodeExecutorRegistry.getAll()` から `payload.nodeType` に一致する executor を検索
2. `executor.getMetadataAsync` が存在する場合、`currentSettings` を渡して呼び出し
3. 存在しない場合、`executor.getMetadata()` を呼び出し
4. 結果を `node:metadataLoaded` メッセージとして返却

**定義場所:** `src/extension/services/MessageBroker.ts`

### §2.6 WebView 側の動的メタデータ管理 (FEAT-00011-002006)

FlowEditorApp に `dynamicMetadata` 状態を追加:

| 状態名 | 型 | 初期値 | 用途 |
|---|---|---|---|
| `dynamicMetadata` | `INodeTypeMetadata \| null` | `null` | settings 依存の動的メタデータを保持 |

**effectiveNodeMetadata 導出ロジック:**
- `dynamicMetadata` が存在し、かつ選択ノードの type と一致する場合 → `dynamicMetadata` を使用
- それ以外 → 静的な `selectedNodeMetadata` を使用

**動的メタデータ要求のトリガー:**
- ノード選択時に `needsDynamic` 判定（現在は `subFlow` / `aiPrompt` タイプ）
- 該当する場合、`node:getMetadata` メッセージを送信
- ノード未選択時または動的メタデータ不要のタイプの場合、`dynamicMetadata` を `null` にリセット

**settings 変更時の再取得:**
- `handleSettingsChange` でノードの settings 更新後、`node:getMetadata` を再送信
- これにより `flowId` 変更時に `outputNodeId` のオプションが自動更新される

**定義場所:** `src/webview/components/FlowEditorApp.tsx`

## 影響範囲

| コンポーネント | 変更内容 |
|---|---|
| `src/extension/interfaces/INodeExecutor.ts` | `getMetadataAsync` オプショナルメソッド追加 |
| `src/extension/executors/SubFlowExecutor.ts` | `outputNodeId` 設定、`getMetadataAsync` 実装追加 |
| `src/extension/services/ExecutionService.ts` | `executeFlow` の `options` に `outputNodeId` 追加、出力選択ロジック追加 |
| `src/extension/services/MessageBroker.ts` | `node:getMetadata` ハンドラ追加 |
| `src/shared/types/messages.ts` | `node:getMetadata`, `node:metadataLoaded` メッセージタイプ追加 |
| `src/webview/components/FlowEditorApp.tsx` | `dynamicMetadata` state、`effectiveNodeMetadata` 導出、settings 変更時の再取得追加 |

## テスト方針

- **UT（SubFlowExecutor.getMetadataAsync）:** 終端ノード検出の正確性、flowId 未選択時の空オプション、load エラー時のフォールバックをテスト
- **UT（ExecutionService.executeFlow）:** outputNodeId 指定時の出力選択、未指定時の従来動作をテスト
- **UT（MessageBroker）:** node:getMetadata ハンドラが getMetadataAsync / getMetadata を適切に呼び分けることをテスト
- **手動テスト:** SubFlow ノードで flowId 選択 → outputNodeId プルダウンに終端ノードが表示されること、選択に応じた出力が返ることを確認

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00011-002002 | SubFlowExecutor 動的メタデータ | FEAT-00011-002002-00001 | getMetadataAsync が終端ノード（出力ポート未接続）を正しく検出する | ✅ |
| FEAT-00011-002002 | SubFlowExecutor 動的メタデータ | FEAT-00011-002002-00002 | flowId 未選択時に outputNodeId オプションが空配列を返す | ✅ |
| FEAT-00011-002002 | SubFlowExecutor 動的メタデータ | FEAT-00011-002002-00003 | flowRepository.load エラー時に outputNodeId オプションが空配列を返す | ✅ |
| FEAT-00011-002002 | SubFlowExecutor 動的メタデータ | FEAT-00011-002002-00004 | flowId 選択で全フロー一覧がオプションに含まれる | ✅ |
| FEAT-00011-002003 | ExecutionService 出力ノード選択 | FEAT-00011-002003-00001 | outputNodeId 指定時に該当ノードの出力が返る | ✅ |
| FEAT-00011-002003 | ExecutionService 出力ノード選択 | FEAT-00011-002003-00002 | outputNodeId 未指定時に最終実行ノードの出力が返る（従来動作） | ✅ |
| FEAT-00011-002003 | ExecutionService 出力ノード選択 | FEAT-00011-002003-00003 | 存在しない outputNodeId 指定時に undefined を返す | ✅ |
| FEAT-00011-002005 | MessageBroker ハンドラ | FEAT-00011-002005-00001 | getMetadataAsync 実装がある executor で非同期メタデータを返す | ✅ |
| FEAT-00011-002005 | MessageBroker ハンドラ | FEAT-00011-002005-00002 | getMetadataAsync 未実装の executor で同期メタデータを返す | ✅ |
| FEAT-00011-002005 | MessageBroker ハンドラ | FEAT-00011-002005-00003 | executor 未検出時に metadataLoaded を返さない | ✅ |
