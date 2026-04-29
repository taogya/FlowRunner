# FEAT-00005: フローのエクスポート/インポート

- 対応する RD 参照: RD-01 §10 #5（リポジトリ外へのフロー共有）

## 概要

フロー定義を JSON ファイルとしてエクスポートし、別のワークスペースでインポートできるようにする。

## スコープ (FEAT-00005-002000)

### 実装する範囲

- `flowrunner.exportFlow` コマンド — フローを `.json` ファイルとして保存
- `flowrunner.importFlow` コマンド — `.json` ファイルからフローを読み込み
- コンテキストメニューからのエクスポート対応
- package.json コマンド登録、NLS ラベル

### スコープ外

- 複数フローの一括エクスポート/インポート
- フローのバージョン互換性チェック
- WebView からのドラッグ&ドロップインポート

## 仕様

### §3.1 エクスポート処理 (FEAT-00005-003001)

1. コンテキストメニューまたはコマンドパレットから `exportFlow` を実行
2. 対象フローを `resolveFlowId(arg)` で特定（引数なし時は QuickPick で選択）
3. `flowService.getFlow()` でフロー定義を取得
4. `vscode.window.showSaveDialog()` で保存先を選択（デフォルトファイル名: `<flowName>.json`）
5. フロー定義を JSON として書き出し（`vscode.workspace.fs.writeFile`）
6. 成功メッセージを表示

### §3.2 インポート処理 (FEAT-00005-003002)

1. コマンドパレットから `importFlow` を実行
2. `vscode.window.showOpenDialog()` で `.json` ファイルを選択
3. ファイルを読み込み、JSON パース
4. バリデーション（name, nodes, edges の存在確認）
5. 新しい flowId を採番して `flowService.createFlow()` + ノード/エッジ上書き + `flowService.saveFlow()`
6. エディタで自動的に開く

### §3.3 CommandRegistry 統合 (FEAT-00005-003003)

- `CommandRegistry.registerAll()` に2コマンドを追加
- 既存の `handleSaveAsTemplate` パターンに準拠

### §3.4 package.json 登録 (FEAT-00005-003004)

- `contributes.commands` に2コマンドを追加
- `contributes.menus.view/item/context` にエクスポートを追加

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00005-003001 | エクスポート | FEAT-00005-003001-00001 | フローをJSONファイルとしてエクスポートできる | ✅ |
| FEAT-00005-003001 | エクスポート | FEAT-00005-003001-00002 | エクスポートキャンセル時にファイルが作成されない | ✅ |
| FEAT-00005-003002 | インポート | FEAT-00005-003002-00001 | JSONファイルからフローをインポートできる | ✅ |
| FEAT-00005-003002 | インポート | FEAT-00005-003002-00002 | 不正なJSONでエラーメッセージが表示される | ✅ |
| FEAT-00005-003002 | インポート | FEAT-00005-003002-00003 | インポートキャンセル時にフローが作成されない | ✅ |
| FEAT-00005-003003 | CommandRegistry | FEAT-00005-003003-00001 | 2コマンドが登録されている | ✅ |
