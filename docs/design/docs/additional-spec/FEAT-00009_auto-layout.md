# FEAT-00009: 自動整列（Auto Layout）

- 対応する REV 参照: REV-016 #8

## 概要

フローキャンバス上のノードを dagre アルゴリズムで自動的に整列し、視認性を向上させる機能。ILayoutEngine インターフェースによりレイアウトエンジンを差し替え可能に設計し、将来 elkjs 等への移行にも対応する。

## スコープ

### 実装範囲

- ILayoutEngine インターフェースの定義
- DagreLayoutEngine（@dagrejs/dagre v3）による LR 方向レイアウト実装
- ツールバーへの「⇶ Auto Layout」ボタン追加
- コンテキストメニュー全3セクション（node / edge / canvas）への「Auto Layout」項目追加
- レイアウト適用前の Undo 履歴保存

### スコープ外

- TB（上→下）方向レイアウトの UI 切替
- ノードサイズの動的計測（固定値 160×60 を使用）
- レイアウトアニメーション（即時反映）
- 部分レイアウト（選択ノードのみ整列）

## 仕様

### §2.1 ILayoutEngine インターフェース (FEAT-00009-002001)

レイアウトエンジンの差し替えを可能にする抽象インターフェース。

| 型名 | 用途 |
|---|---|
| `LayoutNode` | レイアウト対象ノード（id, position, width, height） |
| `LayoutEdge` | レイアウト対象エッジ（source, target） |
| `LayoutOptions` | レイアウトオプション（direction: "LR" \| "TB", nodeSpacing, rankSpacing） |
| `ILayoutEngine` | `layout(nodes, edges, options): LayoutNode[]` メソッドを持つインターフェース |

**定義場所:** `src/webview/interfaces/ILayoutEngine.ts`

### §2.2 DagreLayoutEngine 実装 (FEAT-00009-002002)

ILayoutEngine を実装する Dagre ベースのレイアウトエンジン。

**動作仕様:**

1. dagre グラフを生成し、rankdir / nodesep / ranksep を LayoutOptions から設定
2. 全ノード・エッジをグラフに登録
3. `dagre.layout(g)` でレイアウト計算
4. dagre が返す中心座標から `width/2`, `height/2` を減算して左上座標に変換
5. 元のノード配列と同じ順序で結果を返却

**デフォルトパラメータ:**

| パラメータ | 値 |
|---|---|
| direction | `"LR"` |
| nodeSpacing | `50` |
| rankSpacing | `100` |
| ノード幅（固定） | `160` |
| ノード高さ（固定） | `60` |

**定義場所:** `src/webview/services/DagreLayoutEngine.ts`

### §2.3 UI 統合 (FEAT-00009-002003)

#### ツールバー

- Toolbar コンポーネントに `onAutoLayout` コールバック prop を追加
- 「⇶ Auto Layout」ボタンを表示（`onAutoLayout` が渡された場合のみ）
- `aria-label="Auto Layout"` を設定

#### コンテキストメニュー

- FlowCanvas の右クリックコンテキストメニュー全3セクション（node / edge / canvas）に「Auto Layout」項目を追加

#### handleAutoLayout ハンドラ

1. `state.nodes` から LayoutNode[] を生成（固定サイズ 160×60）
2. `state.edges` から LayoutEdge[] を生成
3. `layoutEngine.layout()` でレイアウト計算
4. `pushState()` で Undo 履歴に保存
5. 計算結果を `NODES_CHANGED` ディスパッチで反映

**定義場所:** `src/webview/components/FlowEditorApp.tsx`, `Toolbar.tsx`, `FlowCanvas.tsx`

### §2.4 Undo 対応 (FEAT-00009-002004)

- `handleAutoLayout` はレイアウト適用前に `pushState({ nodes, edges })` を呼び出す
- Cmd+Z で元の配置に復元可能

## 影響範囲

| コンポーネント | 変更内容 |
|---|---|
| `src/webview/interfaces/ILayoutEngine.ts` | 新規追加 |
| `src/webview/services/DagreLayoutEngine.ts` | 新規追加 |
| `src/webview/components/FlowEditorApp.tsx` | `layoutEngine` インスタンス生成、`handleAutoLayout` ハンドラ追加 |
| `src/webview/components/FlowCanvas.tsx` | `onAutoLayout` prop 追加、コンテキストメニュー項目追加 |
| `src/webview/components/Toolbar.tsx` | `onAutoLayout` prop 追加、ボタン追加 |
| `package.json` | `@dagrejs/dagre` 依存追加 |

## テスト方針

- **UT（DagreLayoutEngine）:** レイアウト計算の正確性、エッジケース（空ノード/エッジなし等）をテスト
- **UT（handleAutoLayout）:** Undo 履歴への保存、ノード位置更新のディスパッチを検証
- **手動テスト:** ツールバーボタン・コンテキストメニューからの Auto Layout 実行、Undo による復元

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00009-002002 | DagreLayoutEngine 実装 | FEAT-00009-002002-00001 | 2ノード1エッジの LR レイアウトが正しい座標を返す | ✅ |
| FEAT-00009-002002 | DagreLayoutEngine 実装 | FEAT-00009-002002-00002 | 空ノード配列で空配列を返す | ✅ |
| FEAT-00009-002002 | DagreLayoutEngine 実装 | FEAT-00009-002002-00003 | エッジなし複数ノードでノードが重複しない | ✅ |
| FEAT-00009-002002 | DagreLayoutEngine 実装 | FEAT-00009-002002-00004 | 分岐・合流を含むグラフで正しくレイアウトされる | ✅ |
| FEAT-00009-002003 | UI 統合 | FEAT-00009-002003-00001 | handleAutoLayout が pushState を呼び出す | ✅ |
| FEAT-00009-002003 | UI 統合 | FEAT-00009-002003-00002 | handleAutoLayout が NODES_CHANGED をディスパッチする | ✅ |
| FEAT-00009-002004 | Undo 対応 | FEAT-00009-002004-00001 | Auto Layout 後に Undo で元の配置に戻る | ✅ |
