# FEAT-00008: Undo/Redo

- 対応する RD 参照: RD-01 §10 #8（Undo/Redo）
- 対応する DD セクション: DD-02-007005

## 概要

フローエディタ上のノード/エッジ操作に対して Undo/Redo 機能を提供する。
コア実装（`useUndoRedo` フック、`FlowEditorApp` 統合）は DD-02-007005 で実装済み。
本 FEAT では macOS Cmd+Shift+Z Redo ショートカットの対応とテスト整備を行う。

## スコープ (FEAT-00008-002000)

### 実装する範囲

- macOS Cmd+Shift+Z Redo ショートカット対応
- キーボードショートカットのテスト追加
- 既存 useUndoRedo フックの検証

### スコープ外

- ノード設定値変更の Undo（RS-01 §4.4 #3 に基づき将来拡張）
- ネストされた Undo（ドラッグ中のリアルタイム追跡など）

## 仕様

### §3.1 useUndoRedo フック (FEAT-00008-003001)

DD-02-007005 に準拠。以下の機能を提供:

| 返却値 | 型 | 説明 |
|---|---|---|
| `undo` | `() => FlowState \| undefined` | 1 つ前の状態に戻す |
| `redo` | `() => FlowState \| undefined` | 1 つ先の状態に進む |
| `canUndo` | boolean | Undo 可能かどうか |
| `canRedo` | boolean | Redo 可能かどうか |
| `pushState` | `(state: FlowState) => void` | 現在の状態を履歴に記録する |

### §3.2 キーボードショートカット (FEAT-00008-003002)

| 操作 | Windows/Linux | macOS |
|---|---|---|
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y | Cmd+Y or Cmd+Shift+Z |
| Save | Ctrl+S | Cmd+S |

**修正内容:** Cmd+Shift+Z → Redo が発火するように条件分岐を修正。
Shift+Z redo チェックは Cmd+Z undo チェックより先に行い、誤動作を防止。

### §3.3 pushState 呼び出し箇所 (FEAT-00008-003003)

| FlowEditorApp 操作 | pushState タイミング |
|---|---|
| ノード追加 (handleNodeDrop) | 追加前 |
| ノード削除 (handleDeleteNode) | 削除前 |
| エッジ接続 (handleConnect) | 接続前 |
| エッジ削除 (handleDeleteEdge) | 削除前 |
| ノード切り取り (handleCutNode) | 切り取り前 |
| ノードペースト (handlePasteNode) | ペースト前 |

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00008-003001 | useUndoRedo | DDUT-02-007005-00001 | 初期状態で canUndo/canRedo が false | ✅ |
| FEAT-00008-003001 | useUndoRedo | DDUT-02-007005-00002 | pushState 後に canUndo が true | ✅ |
| FEAT-00008-003001 | useUndoRedo | DDUT-02-007005-00003 | undo 後に canRedo が true | ✅ |
| FEAT-00008-003001 | useUndoRedo | DDUT-02-007005-00004 | 再レンダリング後もステートが保持される | ✅ |
| FEAT-00008-003001 | useUndoRedo | DDUT-02-007005-00005 | maxHistory 超過時に古い履歴が削除される | ✅ |
| FEAT-00008-003001 | useUndoRedo | DDUT-02-007005-00006 | pushState で redo スタックがクリアされる | ✅ |
| FEAT-00008-003001 | useUndoRedo | DDUT-02-007005-00007 | undo が正しい状態を返す | ✅ |
| FEAT-00008-003002 | ショートカット | FEAT-00008-003002-00001 | Ctrl+Z / Cmd+Z で undo が発火する | ✅ |
| FEAT-00008-003002 | ショートカット | FEAT-00008-003002-00002 | Ctrl+Y / Cmd+Shift+Z で redo が発火する | ✅ |
| FEAT-00008-003002 | ショートカット | FEAT-00008-003002-00003 | Cmd+Shift+Z が undo を発火しない | ✅ |
