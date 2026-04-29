# FEAT-00021: フロー複製

- 対応する参照: 会話要望（2026-04-09）
- 関連: FEAT-00010 (selection-copy), FEAT-00013 (ghost-paste)

## 概要

フロー一覧の右クリックメニューから既存フローを複製できるようにする。複製時は元フローを deep clone したうえで新しい ID と更新済みメタデータを付与して保存し、保存直後に複製先フローを開く。あわせて copy / cut / paste の共有元を拡張側 MessageBroker に集約し、異なるフローやエディタ間でも同じ clipboard 状態を参照できるようにする。

## スコープ

### 実装する範囲

- Flow List view の右クリックメニューに `flowrunner.duplicateFlow` を追加する
- 元フローを deep clone し、新しい `id` を採番して `name` を `<元名> Copy` に更新する
- 複製時に `createdAt` と `updatedAt` を複製時刻へ更新して保存する
- 保存直後に新しいフローエディタを開き、フロー一覧を更新する
- MessageBroker に shared clipboard を保持し、`clipboard:set` / `clipboard:get` / `clipboard:loaded` で WebView と同期する
- 通常コピー / カットと右クリックコピー / カットを shared clipboard に集約する
- 右クリック Paste と Cmd/Ctrl+V が shared clipboard を参照して貼り付け導線へ入る

### スコープ外

- OS clipboard との連携
- 複製名の連番補正やローカライズ済み接尾辞への置き換え
- shared clipboard の永続化（ウィンドウ再起動後の復元）
- 複数ノード用の専用右クリック Paste UI の追加

## 仕様

### §3.1 フロー複製コマンド (FEAT-00021-003001)

| 項目 | 仕様 |
|---|---|
| 起点 | Flow List view の item context に `flowrunner.duplicateFlow` を追加する |
| 対象解決 | 右クリック引数の `flowId` を優先し、未指定時は active editor の `flowId` を使う |
| 複製方式 | 元フローを `structuredClone` で deep clone し、`id` を `crypto.randomUUID()` で再採番する |
| 命名 | `name` は `<元名> Copy` とする |
| メタデータ | `createdAt` / `updatedAt` は複製時刻で上書きする |
| 保存後動作 | `flowService.saveFlow()` 後に `openEditor(newId, newName)` を呼び、新規フローを開いて一覧を refresh する |
| フォールバック | 対象 `flowId` が解決できない場合は warning を表示して終了する |

定義場所: `package.json`, `src/extension/core/CommandRegistry.ts`

### §3.2 共有クリップボード同期 (FEAT-00021-003002)

#### メッセージ契約

| メッセージ | 方向 | Payload | 用途 |
|---|---|---|---|
| `clipboard:set` | WebView → Extension | `nodes`, `edges` | shared clipboard の最新値を保存する |
| `clipboard:get` | WebView → Extension | なし | 現在の shared clipboard を取得する |
| `clipboard:loaded` | Extension → WebView | `nodes`, `edges` | 取得応答および他エディタへの同期通知を返す |

#### 動作仕様

- MessageBroker は module scope の shared clipboard と EventEmitter を持ち、`clipboard:set` 時に deep clone した payload を保持する
- `clipboard:get` は保持中の shared clipboard を `clipboard:loaded` として返し、未設定時は空配列 payload を返す
- WebView 側は起動時に `clipboard:get` を送って現在値を同期する
- `handleCopySelected` と `handleCutSelected` は選択ノードと内部エッジを shared clipboard に保存する
- FlowCanvas の右クリック Copy / Cut は単一ノード payload を `onClipboardSelectionChange` 経由で shared clipboard に保存する
- `handlePasteSelected` はローカル state を直接参照せず、毎回 `clipboard:get` を送って `clipboard:loaded` 受信後にゴーストペーストへ入る
- `applySharedClipboard` は shared clipboard を複数ノード用 `clipboard` と単一ノード用 `nodeClipboard` に正規化する
- 右クリック Paste は `nodeClipboard` を使うため、shared clipboard が単一ノードのときだけ有効化する
- Cmd/Ctrl+V は `clipboard` を使うため、1 ノードでも複数ノードでも同じ shared clipboard からゴーストペーストへ入る

定義場所: `src/extension/services/MessageBroker.ts`, `src/webview/components/FlowEditorApp.tsx`, `src/webview/components/FlowCanvas.tsx`

## 影響範囲

| コンポーネント | 変更内容 | 影響度 |
|---|---|---|
| `package.json` | Flow List view の右クリックメニューに duplicateFlow を追加 | 低 |
| `src/extension/core/CommandRegistry.ts` | フロー複製コマンドの登録と複製処理 | 中 |
| `src/extension/services/MessageBroker.ts` | shared clipboard の保持、取得、全 WebView への同期通知 | 高 |
| `src/webview/components/FlowEditorApp.tsx` | keyboard copy / cut / paste と shared clipboard の同期、ゴーストペースト起動 | 高 |
| `src/webview/components/FlowCanvas.tsx` | 右クリック copy / cut / paste を shared clipboard 起点へ切り替え | 中 |

## テスト方針

- UT で `duplicateFlow` が新しい ID と更新済みメタデータを持つ複製フローを保存し、保存直後に新しいエディタを開くことを確認する
- UT で MessageBroker の `clipboard:get` が `clipboard:loaded` を返し、WebView 間共有用の payload を返却できることを確認する
- WebView コンポーネントテストで Cmd/Ctrl+V が shared clipboard を起点にゴーストペーストへ遷移できることを確認する
- 右クリックメニューからの複製導線、異なるエディタ間での copy / paste、右クリック Paste の単一ノード導線は手動確認で補完する

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00021-003001 | フロー複製コマンド | FEAT-00021-003001-00001 | duplicateFlow が新しい ID と更新済みメタデータで保存し、新規エディタを開く | ✅ |
| FEAT-00021-003002 | 共有クリップボード同期 | FEAT-00021-003002-00001 | MessageBroker の `clipboard:get` が `clipboard:loaded` を返す | ✅ |
| FEAT-00021-003002 | 共有クリップボード同期 | FEAT-00021-003002-00002 | Cmd/Ctrl+V が shared clipboard を起点にゴーストペーストへ遷移する | ✅ |