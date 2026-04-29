# FEAT-00013: ゴーストペースト（Ghost Paste）

- 対応する RD 参照: RD-01 §10 #10（フロー編集 UX 向上）
- 関連: FEAT-00010 (selection-copy) の拡張

## 概要

Cmd+V（ペースト）時に即座にノードを配置するのではなく、ゴーストモードでカーソル追従するインジケーターを表示し、キャンバス上のクリック位置にノードを配置する。Cmd+D（複製）は従来通り即座にオフセット配置を維持。

## スコープ

- **対象:** クリップボードに 1 つ以上のノードがある状態で Cmd+V 実行時
- **ゴーストモード (FEAT-00013-002001):** ペースト操作でゴースト状態に遷移
- **配置確認 (FEAT-00013-002002):** キャンバスクリックで配置、Escape でキャンセル
- **スコープ外:** ゴーストモード中のノードプレビュー描画（インジケーターバッジのみ）

## 仕様

### §2.1 ゴーストモード遷移 (FEAT-00013-002001)

- Cmd+V 押下時: `createRemappedNodes(clipboard, offset=0)` + `remapEdges` で新ノード/エッジ生成
- 生成結果を `ghostPaste` state に保存（配置はしない）
- FlowCanvas にゴーストペーストオーバーレイを表示

### §2.2 配置確認 (FEAT-00013-002002)

- オーバーレイがキャンバス全体を覆い、`cursor: crosshair` を表示
- マウス追従インジケーター: 「📋 N node(s) — Click to place」を表示
- **クリック:** `screenToFlowPosition` でフロー座標に変換し、ゴーストノード群の重心をクリック位置に移動して配置
- **Escape:** ゴーストモードを解除（Escape は通常の deselect より優先）
- 配置時に `pushState` で undo 用保存、既存ノードは deselect、新ノードは selected=true

## 影響範囲

- `src/webview/components/FlowEditorApp.tsx` — handlePasteSelected 変更、ghostPaste state 追加、handleGhostPasteConfirm/Cancel 追加
- `src/webview/components/FlowCanvas.tsx` — ghostPasteNodeCount, onGhostPasteConfirm, onGhostPasteCancel props 追加、オーバーレイ UI
- `src/webview/styles/flowrunner.css` — .fr-ghost-paste-overlay, .fr-ghost-paste-indicator スタイル追加

## テスト方針

- ゴーストモード遷移: Cmd+V でゴースト state が設定されることを検証
- 配置: confirm で正しい位置にノードが配置されることを検証
- キャンセル: Escape でゴースト state がクリアされることを検証

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00013-002001 | ゴーストモード遷移 | FEAT-00013-002001-00001 | Cmd+V でゴースト state が設定される | ✅ |
| FEAT-00013-002002 | 配置確認 | FEAT-00013-002002-00001 | クリックで正しい位置に配置される | ✅ |
| FEAT-00013-002002 | 配置確認 | FEAT-00013-002002-00002 | Escape でゴーストモードが解除される | ✅ |
