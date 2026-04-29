# FEAT-00010: 選択・コピー・ペースト

- 対応する REV 参照: REV-016 #10

## 概要

フローキャンバス上のノードに対するマルチ選択、コピー、ペースト、カット、複製、一括削除、全選択、選択解除の操作を提供する。React Flow のドラッグ範囲選択・Shift マルチ選択と独自のクリップボード管理を組み合わせ、直感的なフロー編集操作を実現する。

## スコープ

### 実装範囲

- ドラッグ範囲選択（selectionOnDrag）
- Shift+クリックによる追加選択（multiSelectionKeyCode="Shift"）
- キーボードショートカット（Cmd+A / C / V / X / D / Delete / Escape）
- クリップボード状態管理（ノード + 内部エッジの保存）
- ペースト時の新 ID 生成・エッジ再接続
- 全操作の Undo 対応
- input/textarea/select フォーカス時のショートカット無効化

### スコープ外

- OS クリップボードとの連携（ブラウザ内クリップボードのみ）
- エッジ単独の選択・コピー
- ノードのドラッグ＆ドロップによる並べ替え（React Flow 標準機能で対応済み）

## 仕様

### §2.1 React Flow 選択設定 (FEAT-00010-002001)

FlowCanvas コンポーネントの ReactFlow に以下の設定を適用:

| プロパティ | 値 | 効果 |
|---|---|---|
| `selectionOnDrag` | `true` | 左クリックドラッグで矩形範囲選択を有効化 |
| `multiSelectionKeyCode` | `"Shift"` | Shift+クリックで追加選択 |
| `deleteKeyCode` | `null` | React Flow の標準 Delete 処理を無効化（独自処理を優先） |

**定義場所:** `src/webview/components/FlowCanvas.tsx`

### §2.2 クリップボード状態管理 (FEAT-00010-002002)

FlowEditorApp に内部クリップボード状態を追加:

| 状態名 | 型 | 初期値 | 用途 |
|---|---|---|---|
| `clipboard` | `{ nodes: FlowNode[]; edges: FlowEdge[] } \| null` | `null` | 選択ノードと内部エッジの一時保持 |

- クリップボードはアプリ内メモリのみで保持（OS クリップボードとは非連携）
- コピー/カット時に選択ノード間のエッジ（source と target がともに選択範囲内）を自動抽出して保存

**定義場所:** `src/webview/components/FlowEditorApp.tsx`

### §2.3 操作ハンドラ一覧 (FEAT-00010-002003)

| ハンドラ名 | ショートカット | 動作 |
|---|---|---|
| `handleSelectAll` | Cmd+A | 全ノードの `selected` を `true` に設定 |
| `handleDeselectAll` | Escape | 全ノードの `selected` を `false` に設定し、`NODE_SELECTED` を `null` に |
| `handleCopySelected` | Cmd+C | 選択ノード + 内部エッジをクリップボードに保存 |
| `handleCutSelected` | Cmd+X | クリップボードにコピー後、選択ノード + 関連エッジを削除 |
| `handlePasteSelected` | Cmd+V | クリップボードのノードを新 ID で生成し、オフセット位置に配置 |
| `handleDuplicateSelected` | Cmd+D | 選択ノードをその場で複製（コピー→ペースト相当） |
| `handleDeleteSelected` | Delete / Backspace | 選択ノード + 関連エッジを削除 |

すべての状態変更ハンドラ（Delete / Cut / Paste / Duplicate）は操作前に `pushState()` で Undo 履歴に保存する。

### §2.4 ペースト・複製の詳細動作 (FEAT-00010-002004)

**新 ID 生成:**
- `crypto.randomUUID()` でノードごとに新しい ID を生成
- 旧 ID → 新 ID のマッピングを `Map<string, string>` で管理
- エッジの `source` / `target` を新 ID にリマップ
- エッジ ID は `e-<newSourceId>-<newTargetId>-<timestamp>` で生成

**オフセット:**
- ペースト・複製ともにオフセット値は `50px`（x, y 両方向）
- ペーストされたノードは `selected: true`、既存ノードは `selected: false` に設定

### §2.5 ショートカット制御 (FEAT-00010-002005)

- `document` の `keydown` イベントリスナーで全ショートカットを一元管理
- `e.target` の tagName が `INPUT` / `TEXTAREA` / `SELECT` の場合はショートカットを無効化
- `e.ctrlKey || e.metaKey`（mod）で修飾キーを判定（Windows / macOS 両対応）
- Cmd+Shift+Z（macOS redo）は Cmd+Z より先に判定
- `e.preventDefault()` で既存ブラウザ動作を抑止

**定義場所:** `src/webview/components/FlowEditorApp.tsx`

## 影響範囲

| コンポーネント | 変更内容 |
|---|---|
| `src/webview/components/FlowEditorApp.tsx` | `clipboard` state 追加、7つの操作ハンドラ追加、keydown リスナー拡張 |
| `src/webview/components/FlowCanvas.tsx` | `selectionOnDrag`, `multiSelectionKeyCode`, `deleteKeyCode` 設定追加 |

## テスト方針

- **UT（ハンドラロジック）:** 各操作ハンドラの状態変更を個別にテスト。クリップボード保存内容、新 ID 生成、エッジリマップ、Undo 履歴保存を検証
- **UT（ショートカット制御）:** input/textarea フォーカス時の無効化、修飾キー判定をテスト
- **手動テスト:** ドラッグ範囲選択、Shift+クリック追加選択、全ショートカット操作の動作確認

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00010-002002 | クリップボード状態管理 | FEAT-00010-002002-00001 | コピー時に選択ノード間のエッジが保存される | ✅ |
| FEAT-00010-002002 | クリップボード状態管理 | FEAT-00010-002002-00002 | 未選択ノードの場合コピーが無操作になる | ✅ |
| FEAT-00010-002003 | 操作ハンドラ | FEAT-00010-002003-00001 | handleSelectAll が全ノードを selected にする | ✅ |
| FEAT-00010-002003 | 操作ハンドラ | FEAT-00010-002003-00002 | handleDeselectAll が全ノードを deselected にする | ✅ |
| FEAT-00010-002003 | 操作ハンドラ | FEAT-00010-002003-00003 | handleCutSelected がコピー後に元ノードを削除する | ✅ |
| FEAT-00010-002003 | 操作ハンドラ | FEAT-00010-002003-00004 | handleDeleteSelected が選択ノードと関連エッジを削除する | ✅ |
| FEAT-00010-002004 | ペースト・複製 | FEAT-00010-002004-00001 | ペースト時に新しいノード ID が生成される | ✅ |
| FEAT-00010-002004 | ペースト・複製 | FEAT-00010-002004-00002 | ペースト時にエッジの source/target が新 ID にリマップされる | ✅ |
| FEAT-00010-002004 | ペースト・複製 | FEAT-00010-002004-00003 | ペースト時にオフセット（50px）が適用される | ✅ |
| FEAT-00010-002004 | ペースト・複製 | FEAT-00010-002004-00004 | 複製が選択ノード＋内部エッジを正しく複製する | ✅ |
| FEAT-00010-002004 | ペースト・複製 | FEAT-00010-002004-00005 | 全操作が pushState で Undo 履歴に保存される | ✅ |
| FEAT-00010-002005 | ショートカット制御 | FEAT-00010-002005-00001 | input/textarea/select フォーカス時にショートカットが無効化される | ✅ |
| FEAT-00010-002005 | ショートカット制御 | FEAT-00010-002005-00002 | Cmd+A/C/V/X/D が正しいハンドラを呼び出す | ✅ |
| FEAT-00010-002005 | ショートカット制御 | FEAT-00010-002005-00003 | Delete/Backspace が handleDeleteSelected を呼び出す | ✅ |
| FEAT-00010-002005 | ショートカット制御 | FEAT-00010-002005-00004 | Escape が handleDeselectAll を呼び出す | ✅ |
