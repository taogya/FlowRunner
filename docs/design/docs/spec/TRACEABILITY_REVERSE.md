# FlowRunner 逆引きトレーサビリティ

---

## 1. UC（ユースケース）

| ID | 概要 | 関連 ID | 関連概要 | 備考 |
|---|---|---|---|---|
| UC-00001 | フローを作成する | BG-00001 | 視覚的なフロー管理不在 |  |
| UC-00001 | フローを作成する | BG-00002 | AI連携自動化基盤不在 |  |
| UC-00002 | フローを編集する | BG-00001 | 視覚的なフロー管理不在 |  |
| UC-00004 | フローを実行する | BG-00001 | 視覚的なフロー管理不在 |  |
| UC-00004 | フローを実行する | BG-00002 | AI連携自動化基盤不在 |  |
| UC-00005 | フローをデバッグする | BG-00001 | 視覚的なフロー管理不在 |  |
| UC-00006 | フロー一覧を閲覧する | BG-00001 | 視覚的なフロー管理不在 |  |
| UC-00007 | フローを共有する | BG-00003 | 定型作業の共有・標準化不足 |  |

---

## 2. FR（機能要求）

| ID | 概要 | 関連 ID | 関連概要 | 備考 |
|---|---|---|---|---|
| FR-00001 | ノードベースビジュアルエディタ | UC-00001 | フローを作成する |  |
| FR-00001 | ノードベースビジュアルエディタ | UC-00002 | フローを編集する |  |
| FR-00002 | ビルトインノード提供 | UC-00001 | フローを作成する |  |
| FR-00003 | ノード入出力設定 | UC-00001 | フローを作成する |  |
| FR-00003 | ノード入出力設定 | UC-00002 | フローを編集する |  |
| FR-00004 | サイドバーフロー管理UI | UC-00006 | フロー一覧を閲覧する |  |
| FR-00005 | フロー定義永続化 | UC-00001 | フローを作成する |  |
| FR-00005 | フロー定義永続化 | UC-00002 | フローを編集する |  |
| FR-00005 | フロー定義永続化 | UC-00003 | フローを削除する |  |
| FR-00005 | フロー定義永続化 | UC-00007 | フローを共有する |  |
| FR-00006 | フロー定義削除 | UC-00003 | フローを削除する |  |
| FR-00007 | フロー実行 | UC-00004 | フローを実行する |  |
| FR-00008 | 実行状態フィードバック | UC-00004 | フローを実行する |  |
| FR-00008 | 実行状態フィードバック | UC-00005 | フローをデバッグする |  |
| FR-00009 | フロー完了通知 | UC-00004 | フローを実行する |  |
| FR-00010 | ステップ実行 | UC-00005 | フローをデバッグする |  |
| FR-00011 | 中間結果表示 | UC-00005 | フローをデバッグする |  |
| FR-00012 | 実行履歴記録 | UC-00008 | 実行履歴を確認する |  |
| FR-00013 | 実行結果参照・比較 | UC-00008 | 実行履歴を確認する |  |

---

## 3. QR（品質要求）

| ID | 概要 | 関連 ID | 関連概要 | 備考 |
|---|---|---|---|---|
| QR-00001 | 拡張性 | FR-00002 | ビルトインノード提供 |  |
| QR-00001 | 拡張性 | FR-00014 | プラグインアーキテクチャ |  |
| QR-00002 | 信頼性 | FR-00007 | フロー実行 |  |
| QR-00003 | 使いやすさ | FR-00001 | ノードベースビジュアルエディタ |  |
| QR-00003 | 使いやすさ | FR-00003 | ノード入出力設定 |  |
| QR-00003 | 使いやすさ | FR-00004 | サイドバーフロー管理UI |  |
| QR-00003 | 使いやすさ | FR-00008 | 実行状態フィードバック |  |
| QR-00003 | 使いやすさ | FR-00010 | ステップ実行 |  |
| QR-00003 | 使いやすさ | FR-00015 | 多言語対応（EN/JA） |  |
| QR-00004 | パフォーマンス | FR-00001 | ノードベースビジュアルエディタ |  |
| QR-00004 | パフォーマンス | FR-00007 | フロー実行 |  |
| QR-00005 | セキュリティ | FR-00005 | フロー定義永続化 |  |
| QR-00006 | 保守性 | FR-00014 | プラグインアーキテクチャ |  |

---

## 4. RD（要求定義セクション）

| ID | 概要 | 関連 ID | 関連概要 | 備考 |
|---|---|---|---|---|
| RD-01-002000 | ステークホルダー | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-003000 | 背景 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-004000 | システムコンテキスト | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-005001 | ユースケース図 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-005002 | ユースケース一覧 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-006001 | フロー設計 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-006002 | ビルトインノード一覧 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-006003 | フロー管理 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-006004 | フロー実行 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-006005 | デバッグ | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-006006 | 実行履歴 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-006007 | 拡張性 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-006008 | 国際化 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-007000 | 品質要求 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-008000 | 制約事項 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-009000 | 前提条件 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-010000 | 将来拡張 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |
| RD-01-011000 | 用語集 | — | — | RD 最上位。項目 ID（BG/UC/FR 等）で追跡 |

---

## 5. RS（要件定義セクション）

| ID | 概要 | 関連 ID | 関連概要 | 備考 |
|---|---|---|---|---|
| RS-01-002000 | UI構造 | FR-00001 | ノードベースビジュアルエディタ |  |
| RS-01-003001 | 表示要件 | FR-00004 | サイドバーフロー管理UI |  |
| RS-01-003002 | 操作要件 | FR-00004 | サイドバーフロー管理UI |  |
| RS-01-003002 | 操作要件 | FR-00006 | フロー定義削除 |  |
| RS-01-004001 | レイアウト | FR-00001 | ノードベースビジュアルエディタ |  |
| RS-01-004002 | キャンバス操作 | FR-00001 | ノードベースビジュアルエディタ |  |
| RS-01-004002 | キャンバス操作 | FR-00003 | ノード入出力設定 |  |
| RS-01-004003 | コンテキストメニュー | FR-00001 | ノードベースビジュアルエディタ |  |
| RS-01-004004 | Undo / Redo | FR-00001 | ノードベースビジュアルエディタ |  |
| RS-01-004005 | ツールバー | FR-00001 | ノードベースビジュアルエディタ |  |
| RS-01-005001 | プロパティパネル概要 | FR-00001 | ノードベースビジュアルエディタ |  |
| RS-01-005002 | タブ構成 | FR-00001 | ノードベースビジュアルエディタ |  |
| RS-01-005003 | プロパティパネル要件 | FR-00001 | ノードベースビジュアルエディタ |  |
| RS-01-006001 | 保存仕様 | FR-00005 | フロー定義永続化 |  |
| RS-01-006002 | 共有仕様 | FR-00005 | フロー定義永続化 |  |
| RS-01-007000 | 設定 | FR-00005 | フロー定義永続化 |  |
| RS-01-008000 | 多言語対応 | FR-00015 | 多言語対応（EN/JA） |  |
| RS-02-002001 | ポートモデル | FR-00003 | ノード入出力設定 |  |
| RS-02-002002 | ノード共通属性 | FR-00002 | ビルトインノード提供 |  |
| RS-02-002003 | 拡張性 | FR-00014 | プラグインアーキテクチャ |  |
| RS-02-003001 | トリガーノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003002 | コマンド実行ノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003003 | AIプロンプトノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003004 | 条件分岐ノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003005 | ループノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003006 | ログ出力ノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003007 | ファイル操作ノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003008 | HTTPリクエストノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003009 | 変数・データ変換ノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003010 | コメントノード | FR-00002 | ビルトインノード提供 |  |
| RS-02-003011 | フロー連携ノード | FR-00002 | ビルトインノード提供 |  |
| RS-03-002001 | 実行フロー | FR-00007 | フロー実行 |  |
| RS-03-002002 | 実行仕様 | FR-00007 | フロー実行 |  |
| RS-03-002002 | 実行仕様 | FR-00008 | 実行状態フィードバック |  |
| RS-03-002003 | エラー時の動作 | FR-00007 | フロー実行 |  |
| RS-03-002004 | 実行時フィードバック | FR-00008 | 実行状態フィードバック |  |
| RS-03-003001 | デバッグモード | FR-00010 | ステップ実行 |  |
| RS-03-003002 | ステップ実行 | FR-00010 | ステップ実行 |  |
| RS-03-003003 | 中間結果表示 | FR-00011 | 中間結果表示 |  |
| RS-03-004001 | 保存仕様 | FR-00012 | 実行履歴記録 |  |
| RS-03-004002 | 履歴データ | FR-00012 | 実行履歴記録 |  |
| RS-03-004003 | 履歴参照 | FR-00013 | 実行結果参照・比較 |  |
| RS-03-005000 | 完了通知 | FR-00009 | フロー完了通知 |  |

---

## 6. BD（基本設計セクション）

| ID | 概要 | 関連 ID | 関連概要 | 備考 |
|---|---|---|---|---|
| BD-01-002001 | レイヤー構成 | RS-01-002000 | UI構造 |  |
| BD-01-002002 | レイヤー間の責務分離 | RS-01-002000 | UI構造 |  |
| BD-01-003001 | コンポーネント一覧 | RS-01-003001 | 表示要件 | FlowTreeProvider |
| BD-01-003001 | コンポーネント一覧 | RS-01-003002 | 操作要件 | CommandRegistry |
| BD-01-003001 | コンポーネント一覧 | RS-01-004001 | レイアウト | FlowEditorManager, WebView コンポーネント |
| BD-01-003001 | コンポーネント一覧 | RS-01-004002 | キャンバス操作 | FlowCanvas |
| BD-01-003001 | コンポーネント一覧 | RS-01-004005 | ツールバー | Toolbar |
| BD-01-003001 | コンポーネント一覧 | RS-01-005001 | プロパティパネル概要 | PropertyPanel |
| BD-01-003001 | コンポーネント一覧 | RS-01-005002 | タブ構成 | PropertyPanel |
| BD-01-003001 | コンポーネント一覧 | RS-01-005003 | プロパティパネル要件 | PropertyPanel |
| BD-01-003001 | コンポーネント一覧 | RS-01-006001 | 保存仕様 | FlowService, FlowRepository |
| BD-01-003001 | コンポーネント一覧 | RS-01-006002 | 共有仕様 | FlowRepository |
| BD-01-003001 | コンポーネント一覧 | RS-02-002003 | 拡張性 | NodeExecutorRegistry, INodeExecutor |
| BD-01-003001 | コンポーネント一覧 | RS-03-002001 | 実行フロー | ExecutionService |
| BD-01-003001 | コンポーネント一覧 | RS-03-002002 | 実行仕様 | ExecutionService |
| BD-01-003001 | コンポーネント一覧 | RS-03-003001 | デバッグモード | DebugService |
| BD-01-003001 | コンポーネント一覧 | RS-03-004001 | 保存仕様 | HistoryService, HistoryRepository |
| BD-01-003001 | コンポーネント一覧 | RS-03-004002 | 履歴データ | HistoryService |
| BD-01-003001 | コンポーネント一覧 | RS-03-005000 | 完了通知 | ExecutionService |
| BD-01-003002 | コンポーネント間の依存関係 | RS-01-003002 | 操作要件 | CommandRegistry の依存先 |
| BD-01-004001 | 通信方式 | RS-03-002001 | 実行フロー | postMessage プロトコル定義 |
| BD-01-004002 | メッセージ型一覧 | RS-02-002001 | ポートモデル | フロー定義データに含まれる |
| BD-01-004002 | メッセージ型一覧 | RS-03-002001 | 実行フロー | execution:* メッセージ群 |
| BD-01-004002 | メッセージ型一覧 | RS-03-002003 | エラー時の動作 | execution:nodeError |
| BD-01-004002 | メッセージ型一覧 | RS-03-003001 | デバッグモード | debug:* メッセージ群 |
| BD-01-004002 | メッセージ型一覧 | RS-03-003002 | ステップ実行 | debug:step, debug:paused |
| BD-01-004002 | メッセージ型一覧 | RS-03-003003 | 中間結果表示 | debug:paused |
| BD-01-005001 | Activation Events | RS-01-003001 | 表示要件 | onView:flowrunner.flowList |
| BD-01-005001 | Activation Events | BDIT-01-005001-00001 | activationEvents に onView が含まれる |  |
| BD-01-005001 | Activation Events | BDIT-01-005001-00002 | activationEvents に createFlow コマンドが含まれる |  |
| BD-01-005001 | Activation Events | BDIT-01-005001-00003 | activationEvents に openEditor コマンドが含まれる |  |
| BD-01-005002 | Contributes 設計 | RS-01-003001 | 表示要件 | Views |
| BD-01-005002 | Contributes 設計 | RS-01-003002 | 操作要件 | Commands, Menus |
| BD-01-005002 | Contributes 設計 | RS-01-007000 | 設定 | Configuration |
| BD-01-005002 | Contributes 設計 | RS-01-008000 | 多言語対応 | L10n Bundle |
| BD-01-005002 | Contributes 設計 | BDIT-01-005002-00001 | viewsContainers に flowrunner が定義されている |  |
| BD-01-005002 | Contributes 設計 | BDIT-01-005002-00002 | views に flowrunner.flowList が tree 型で定義 |  |
| BD-01-005002 | Contributes 設計 | BDIT-01-005002-00003 | commands に BD 定義の 6 コマンドが含まれる |  |
| BD-01-005002 | Contributes 設計 | BDIT-01-005002-00004 | menus が BD 設計と一致する |  |
| BD-01-005002 | Contributes 設計 | BDIT-01-005002-00005 | configuration に autoSave と historyMaxCount が含まれる |  |
| BD-01-005002 | Contributes 設計 | BDIT-01-005002-00006 | dependencies に @vscode/l10n が含まれる |  |
| BD-02-002001 | FlowTreeProvider 概要 | RS-01-003001 | 表示要件 |  |
| BD-02-002002 | IFlowTreeProvider インターフェース | RS-01-003001 | 表示要件 |  |
| BD-02-002002 | IFlowTreeProvider インターフェース | BDIT-02-002002-00001 | ルートアイテムを返す（親指定なし） |  |
| BD-02-002002 | IFlowTreeProvider インターフェース | BDIT-02-002002-00002 | 子アイテムを返す（親ID指定） |  |
| BD-02-002002 | IFlowTreeProvider インターフェース | BDIT-02-002002-00003 | ツリーアイテムを返す（フロー型） |  |
| BD-02-002002 | IFlowTreeProvider インターフェース | BDIT-02-002002-00004 | リフレッシュが例外を発生しない |  |
| BD-02-002003 | FlowTreeItem 型 | RS-01-003001 | 表示要件 |  |
| BD-02-002004 | コンテキストメニューとコマンドバインディング | RS-01-003002 | 操作要件 |  |
| BD-02-002005 | 検索・フィルター | RS-01-003001 | 表示要件 |  |
| BD-02-002005 | 検索・フィルター | — | — | VSCode 組み込み機能のため DD 設計不要 |
| BD-02-002006 | FlowService との連携 | RS-01-003001 | 表示要件 |  |
| BD-02-003001 | FlowEditorManager 概要 | RS-01-004001 | レイアウト |  |
| BD-02-003002 | IFlowEditorManager インターフェース | RS-01-004001 | レイアウト |  |
| BD-02-003002 | IFlowEditorManager インターフェース | BDIT-02-003002-00001 | 新規フローでパネル作成 |  |
| BD-02-003002 | IFlowEditorManager インターフェース | BDIT-02-003002-00002 | 既存フローで既存パネルをアクティベート |  |
| BD-02-003002 | IFlowEditorManager インターフェース | BDIT-02-003002-00003 | 開いたフローのパネルを閉じる |  |
| BD-02-003002 | IFlowEditorManager インターフェース | BDIT-02-003002-00004 | エディタなしでundefined返却 |  |
| BD-02-003002 | IFlowEditorManager インターフェース | BDIT-02-003002-00005 | 開いたエディタのフローID返却 |  |
| BD-02-003002 | IFlowEditorManager インターフェース | BDIT-02-003002-00006 | 全パネルをdispose |  |
| BD-02-003003 | パネルライフサイクル | RS-01-004001 | レイアウト |  |
| BD-02-003004 | WebviewPanel のオプション設計 | RS-01-004001 | レイアウト |  |
| BD-02-003005 | MessageBroker との連携 | RS-01-004001 | レイアウト |  |
| BD-02-004001 | コンポーネント階層 | RS-01-004001 | レイアウト |  |
| BD-02-004002 | FlowEditorApp | RS-01-004002 | キャンバス操作 |  |
| BD-02-004003 | Toolbar | RS-01-004005 | ツールバー |  |
| BD-02-004004 | NodePalette | RS-01-004001 | レイアウト |  |
| BD-02-004005 | FlowCanvas | RS-01-004002 | キャンバス操作 |  |
| BD-02-004005 | FlowCanvas | RS-01-004003 | コンテキストメニュー | コンテキストメニューは FlowCanvas に包含 |
| BD-02-004005 | FlowCanvas | RS-01-004004 | Undo / Redo | Undo/Redo は FlowCanvas に包含 |
| BD-02-004006 | PropertyPanel | RS-01-005001 | プロパティパネル概要 |  |
| BD-02-004006 | PropertyPanel | RS-01-005002 | タブ構成 |  |
| BD-02-004006 | PropertyPanel | RS-01-005003 | プロパティパネル要件 |  |
| BD-02-004007 | MessageClient | RS-01-004001 | レイアウト | WebView 通信抽象化 |
| BD-02-004007 | MessageClient | BDIT-02-004007-00001 | メッセージ送信でメッセージが記録される |  |
| BD-02-004007 | MessageClient | BDIT-02-004007-00002 | メッセージ受信ハンドラでメッセージを受信する |  |
| BD-02-004007 | MessageClient | BDIT-02-004007-00003 | Dispose 後にメッセージを受信しない |  |
| BD-02-005001 | 主要操作フロー | RS-01-004001 | レイアウト |  |
| BD-02-005002 | フロー一覧操作 | RS-01-003002 | 操作要件 |  |
| BD-02-005003 | エディタ操作 | RS-01-004002 | キャンバス操作 |  |
| BD-02-005003 | エディタ操作 | RS-01-006001 | 保存仕様 | 保存フロー |
| BD-03-002001 | INodeExecutor 概要 | RS-02-002003 | 拡張性 |  |
| BD-03-002002 | INodeExecutor メソッド定義 | RS-02-002003 | 拡張性 |  |
| BD-03-002002 | INodeExecutor メソッド定義 | BDIT-03-002002-00001 | 有効なコンテキストで実行結果返却 |  |
| BD-03-002002 | INodeExecutor メソッド定義 | BDIT-03-002002-00002 | 有効な設定で検証成功 |  |
| BD-03-002002 | INodeExecutor メソッド定義 | BDIT-03-002002-00003 | 無効な設定でエラー返却 |  |
| BD-03-002002 | INodeExecutor メソッド定義 | BDIT-03-002002-00004 | ノードメタデータ返却 |  |
| BD-03-002003 | IExecutionContext | RS-02-002003 | 拡張性 |  |
| BD-03-002003 | IExecutionContext | RS-03-002002 | 実行仕様 |  |
| BD-03-002004 | IExecutionResult | RS-02-002003 | 拡張性 |  |
| BD-03-002004 | IExecutionResult | RS-03-002002 | 実行仕様 |  |
| BD-03-002004 | IExecutionResult | RS-03-002004 | 実行時フィードバック | ExecutionStatus |
| BD-03-002005 | ValidationResult | RS-02-002003 | 拡張性 |  |
| BD-03-003001 | NodeExecutorRegistry 概要 | RS-02-002003 | 拡張性 |  |
| BD-03-003002 | INodeExecutorRegistry インターフェース | RS-02-002003 | 拡張性 |  |
| BD-03-003002 | INodeExecutorRegistry インターフェース | BDIT-03-003002-00001 | 新しいノード型の登録成功 |  |
| BD-03-003002 | INodeExecutorRegistry インターフェース | BDIT-03-003002-00002 | 登録済み型からExecutor取得 |  |
| BD-03-003002 | INodeExecutorRegistry インターフェース | BDIT-03-003002-00003 | 登録済み型で真を返す |  |
| BD-03-003002 | INodeExecutorRegistry インターフェース | BDIT-03-003002-00004 | 未登録型で偽を返す |  |
| BD-03-003002 | INodeExecutorRegistry インターフェース | BDIT-03-003002-00005 | 登録済みExecutorを全て返す |  |
| BD-03-003003 | 初期化と登録フロー | RS-02-002003 | 拡張性 |  |
| BD-03-004001 | INodeTypeMetadata | RS-02-002002 | ノード共通属性 |  |
| BD-03-004002 | PortDefinition | RS-02-002001 | ポートモデル |  |
| BD-03-004003 | SettingFieldDef | RS-02-002003 | 拡張性 |  |
| BD-03-005001 | フロー定義データモデル概要 | RS-01-006001 | 保存仕様 |  |
| BD-03-005002 | FlowDefinition | RS-01-006001 | 保存仕様 |  |
| BD-03-005003 | NodeInstance | RS-02-002002 | ノード共通属性 |  |
| BD-03-005004 | EdgeInstance | RS-02-002001 | ポートモデル |  |
| BD-03-005005 | IFlowRepository インターフェース | RS-01-006001 | 保存仕様 |  |
| BD-03-005005 | IFlowRepository インターフェース | BDIT-03-005005-00001 | フロー定義の保存成功 |  |
| BD-03-005005 | IFlowRepository インターフェース | BDIT-03-005005-00002 | 保存後にフロー定義を返す |  |
| BD-03-005005 | IFlowRepository インターフェース | BDIT-03-005005-00003 | 既存フローを削除 |  |
| BD-03-005005 | IFlowRepository インターフェース | BDIT-03-005005-00004 | 保存フローのサマリー一覧 |  |
| BD-03-005005 | IFlowRepository インターフェース | BDIT-03-005005-00005 | 既存フロー存在確認で真 |  |
| BD-03-005005 | IFlowRepository インターフェース | BDIT-03-005005-00006 | 非既存フロー存在確認で偽 |  |
| BD-03-006001 | TriggerExecutor | RS-02-003001 | トリガーノード |  |
| BD-03-006002 | CommandExecutor | RS-02-003002 | コマンド実行ノード |  |
| BD-03-006003 | AIPromptExecutor | RS-02-003003 | AIプロンプトノード |  |
| BD-03-006004 | ConditionExecutor | RS-02-003004 | 条件分岐ノード |  |
| BD-03-006005 | LoopExecutor | RS-02-003005 | ループノード |  |
| BD-03-006006 | LogExecutor | RS-02-003006 | ログ出力ノード |  |
| BD-03-006007 | FileExecutor | RS-02-003007 | ファイル操作ノード |  |
| BD-03-006008 | HttpExecutor | RS-02-003008 | HTTPリクエストノード |  |
| BD-03-006009 | TransformExecutor | RS-02-003009 | 変数・データ変換ノード |  |
| BD-03-006010 | CommentExecutor | RS-02-003010 | コメントノード |  |
| BD-03-006011 | SubFlowExecutor | RS-02-003011 | フロー連携ノード |  |
| BD-04-002001 | ExecutionService 概要 | RS-03-002001 | 実行フロー |  |
| BD-04-002002 | IExecutionService インターフェース | RS-03-002002 | 実行仕様 |  |
| BD-04-002002 | IExecutionService インターフェース | BDIT-04-002002-00001 | 有効なフローIDで実行完了 |  |
| BD-04-002002 | IExecutionService インターフェース | BDIT-04-002002-00002 | 実行前で実行状態が偽 |  |
| BD-04-002002 | IExecutionService インターフェース | BDIT-04-002002-00003 | 実行フロー一覧が空配列 |  |
| BD-04-002002 | IExecutionService インターフェース | BDIT-04-002002-00004 | 実行中のフロー停止 |  |
| BD-04-002002 | IExecutionService インターフェース | BDIT-04-002002-00005 | 実行中にフローイベント受信 |  |
| BD-04-002003 | 実行フロー詳細 | RS-03-002001 | 実行フロー |  |
| BD-04-002004 | データ伝播 | RS-03-002002 | 実行仕様 |  |
| BD-04-002005 | フロー停止 | RS-03-002002 | 実行仕様 |  |
| BD-04-002006 | エラーポリシー | RS-03-002003 | エラー時の動作 |  |
| BD-04-002007 | 実行時フィードバック | RS-03-002004 | 実行時フィードバック |  |
| BD-04-003001 | DebugService 概要 | RS-03-003001 | デバッグモード |  |
| BD-04-003002 | IDebugService インターフェース | RS-03-003001 | デバッグモード |  |
| BD-04-003002 | IDebugService インターフェース | BDIT-04-003002-00001 | 有効なフローIDでデバッグ開始 |  |
| BD-04-003002 | IDebugService インターフェース | BDIT-04-003002-00002 | 開始前でデバッグ状態が偽 |  |
| BD-04-003002 | IDebugService インターフェース | BDIT-04-003002-00003 | 1ノード単位のステップ実行 |  |
| BD-04-003002 | IDebugService インターフェース | BDIT-04-003002-00004 | デバッグ中にデバッグ停止 |  |
| BD-04-003002 | IDebugService インターフェース | BDIT-04-003002-00005 | ステップ後に中間結果返却 |  |
| BD-04-003002 | IDebugService インターフェース | BDIT-04-003002-00006 | ステップ後にデバッグイベント受信 |  |
| BD-04-003003 | デバッグ実行フロー | RS-03-003001 | デバッグモード |  |
| BD-04-003003 | デバッグ実行フロー | RS-03-003002 | ステップ実行 |  |
| BD-04-003004 | 中間結果 | RS-03-003003 | 中間結果表示 |  |
| BD-04-003005 | 条件分岐・ループの扱い | RS-03-003002 | ステップ実行 |  |
| BD-04-004001 | HistoryService 概要 | RS-03-004001 | 保存仕様 |  |
| BD-04-004001 | HistoryService 概要 | BDIT-04-004001-00001 | 実行記録の保存成功 |  |
| BD-04-004001 | HistoryService 概要 | BDIT-04-004001-00002 | 保存後に実行記録返却 |  |
| BD-04-004001 | HistoryService 概要 | BDIT-04-004001-00003 | 保存記録のサマリー一覧 |  |
| BD-04-004001 | HistoryService 概要 | BDIT-04-004001-00004 | 既存記録IDで記録削除 |  |
| BD-04-004001 | HistoryService 概要 | BDIT-04-004001-00005 | 超過記録を古い順に削除 |  |
| BD-04-004002 | IHistoryService インターフェース | RS-03-004001 | 保存仕様 |  |
| BD-04-004002 | IHistoryService インターフェース | BDIT-04-004001-00001 | 実行記録の保存成功 | 004001 にも紐付け済 |
| BD-04-004002 | IHistoryService インターフェース | BDIT-04-004001-00002 | 保存後に実行記録返却 | 004001 にも紐付け済 |
| BD-04-004002 | IHistoryService インターフェース | BDIT-04-004001-00003 | 保存記録のサマリー一覧 | 004001 にも紐付け済 |
| BD-04-004002 | IHistoryService インターフェース | BDIT-04-004001-00004 | 既存記録IDで記録削除 | 004001 にも紐付け済 |
| BD-04-004002 | IHistoryService インターフェース | BDIT-04-004001-00005 | 超過記録を古い順に削除 | 004001 にも紐付け済 |
| BD-04-004003 | ExecutionRecord | RS-03-004002 | 履歴データ |  |
| BD-04-004004 | IHistoryRepository インターフェース | RS-03-004001 | 保存仕様 |  |
| BD-04-004004 | IHistoryRepository インターフェース | BDIT-04-004004-00001 | 実行記録の保存成功 |  |
| BD-04-004004 | IHistoryRepository インターフェース | BDIT-04-004004-00002 | 保存後に実行記録返却 |  |
| BD-04-004004 | IHistoryRepository インターフェース | BDIT-04-004004-00003 | 保存後に記録サマリー一覧 |  |
| BD-04-004004 | IHistoryRepository インターフェース | BDIT-04-004004-00004 | 既存記録IDで記録削除 |  |
| BD-04-004004 | IHistoryRepository インターフェース | BDIT-04-004004-00005 | 保存記録数を正確に返す |  |
| BD-04-004005 | 保持件数管理 | RS-03-004001 | 保存仕様 |  |
| BD-04-004006 | 履歴参照 UI | RS-03-004003 | 履歴参照 |  |
| BD-04-005001 | 通知設計 | RS-03-005000 | 完了通知 |  |
| BD-04-005002 | 通知アクション | RS-03-005000 | 完了通知 |  |

---

## 7. DD（詳細設計セクション）

| ID | 概要 | 関連 ID | 関連概要 | 備考 |
|---|---|---|---|---|
| DD-01-002001 | ExtensionMain 概要 | BD-01-003001 | コンポーネント一覧 | ExtensionMain |
| DD-01-002002 | クラス設計 | BD-01-003001 | コンポーネント一覧 | ExtensionMain |
| DD-01-002003 | 初期化フェーズ | BD-01-003002 | コンポーネント間の依存関係 |  |
| DD-01-002003 | 初期化フェーズ | BD-01-005001 | Activation Events |  |
| DD-01-002004 | deactivate 処理 | BD-01-003001 | コンポーネント一覧 | ExtensionMain |
| DD-01-002004 | deactivate 処理 | DDUT-01-002004-00001 | deactivate は空関数 |  |
| DD-01-002005 | エラーハンドリング | BD-01-003001 | コンポーネント一覧 | ExtensionMain |
| DD-01-003001 | FlowService 概要 | BD-01-003001 | コンポーネント一覧 | FlowService |
| DD-01-003002 | IFlowService インターフェース | BD-01-003001 | コンポーネント一覧 | FlowService |
| DD-01-003003 | FlowService クラス設計 | BD-01-003001 | コンポーネント一覧 | FlowService |
| DD-01-003004 | メソッド詳細 | BD-01-003001 | コンポーネント一覧 | FlowService |
| DD-01-003004 | FlowService メソッド詳細 | DDUT-01-003004-00001 | createFlow 有効名でフロー返却 |  |
| DD-01-003004 | FlowService メソッド詳細 | DDUT-01-003004-00002 | createFlow 一意 ID 生成 |  |
| DD-01-003004 | FlowService メソッド詳細 | DDUT-01-003004-00003 | getFlow 既存 ID でフロー返却 |  |
| DD-01-003004 | FlowService メソッド詳細 | DDUT-01-003004-00004 | getFlow 不明 ID で例外 |  |
| DD-01-003004 | FlowService メソッド詳細 | DDUT-01-003004-00005 | saveFlow タイムスタンプ更新・永続化 |  |
| DD-01-003004 | FlowService メソッド詳細 | DDUT-01-003004-00006 | deleteFlow リポジトリ委譲 |  |
| DD-01-003004 | FlowService メソッド詳細 | DDUT-01-003004-00007 | renameFlow 名前更新・保存 |  |
| DD-01-003004 | FlowService メソッド詳細 | DDUT-01-003004-00008 | listFlows サマリー返却 |  |
| DD-01-003004 | FlowService メソッド詳細 | DDUT-01-003004-00009 | existsFlow リポジトリ委譲 |  |
| DD-01-003005 | トリガーノード自動生成 | BD-01-003001 | コンポーネント一覧 | FlowService |
| DD-01-003005 | トリガーノード自動生成 | DDUT-01-003005-00001 | createFlow トリガーノード自動配置 |  |
| DD-01-004001 | CommandRegistry 概要 | BD-01-003001 | コンポーネント一覧 | CommandRegistry |
| DD-01-004002 | CommandRegistry クラス設計 | BD-01-003001 | コンポーネント一覧 | CommandRegistry |
| DD-01-004003 | registerAll メソッド | BD-01-005002 | Contributes 設計 | Commands |
| DD-01-004003 | registerAll メソッド | DDUT-01-004003-00001 | registerAll 6 コマンド登録 |  |
| DD-01-004003 | registerAll メソッド | DDUT-01-004003-00002 | createFlow コマンド登録 |  |
| DD-01-004003 | registerAll メソッド | DDUT-01-004003-00003 | openEditor コマンド登録 |  |
| DD-01-004003 | registerAll メソッド | DDUT-01-004003-00004 | executeFlow コマンド登録 |  |
| DD-01-004004 | wrapHandler | BD-01-003001 | コンポーネント一覧 | CommandRegistry |
| DD-01-004004 | wrapHandler | DDUT-01-004004-00001 | wrapHandler エラーキャッチ・表示 |  |
| DD-01-004005 | CommandRegistry dispose | BD-01-003001 | コンポーネント一覧 | CommandRegistry |
| DD-01-004005 | dispose | DDUT-01-004005-00001 | dispose 全コマンド解放 |  |
| DD-01-005001 | MessageBroker 概要 | BD-01-004001 | 通信方式 |  |
| DD-01-005002 | MessageBroker クラス設計 | BD-01-004001 | 通信方式 |  |
| DD-01-005003 | ハンドラ登録 | BD-01-004002 | メッセージ型一覧 |  |
| DD-01-005004 | handleMessage メソッド | BD-01-004001 | 通信方式 |  |
| DD-01-005004 | handleMessage メソッド | DDUT-01-005004-00001 | handleMessage flow:load → getFlow |  |
| DD-01-005004 | handleMessage メソッド | DDUT-01-005004-00002 | handleMessage flow:save → saveFlow |  |
| DD-01-005004 | handleMessage メソッド | DDUT-01-005004-00003 | handleMessage flow:execute → executeFlow |  |
| DD-01-005004 | handleMessage メソッド | DDUT-01-005004-00004 | handleMessage 不明 type → error 送信 |  |
| DD-01-005004 | handleMessage メソッド | DDUT-01-005004-00005 | handleMessage ハンドラ例外 → error 送信 |  |
| DD-01-005005 | イベントフォワーディング | BD-01-004002 | メッセージ型一覧 |  |
| DD-01-005005 | イベントフォワーディング | DDUT-01-005005-00001 | setupEventForwarding 実行イベント転送 |  |
| DD-01-005006 | MessageBroker dispose | BD-01-004001 | 通信方式 |  |
| DD-01-005006 | dispose | DDUT-01-005006-00001 | dispose イベント購読解放 |  |
| DD-02-002001 | FlowTreeProvider 概要 | BD-02-002001 | FlowTreeProvider 概要 |  |
| DD-02-002002 | FlowTreeProvider クラス設計 | BD-02-002002 | IFlowTreeProvider インターフェース |  |
| DD-02-002003 | getChildren 実装 | BD-02-002003 | FlowTreeItem 型 |  |
| DD-02-002003 | getChildren 実装 | BD-02-002006 | FlowService との連携 |  |
| DD-02-002003 | getChildren 実装 | DDUT-02-002003-00001 | getChildren ルートアイテム返却 |  |
| DD-02-002004 | getTreeItem 実装 | BD-02-002004 | コンテキストメニューとコマンドバインディング |  |
| DD-02-002004 | getTreeItem 実装 | DDUT-02-002004-00001 | getTreeItem コマンド付き TreeItem 返却 |  |
| DD-02-002005 | コンテキストメニュー設定 | BD-02-002004 | コンテキストメニューとコマンドバインディング |  |
| DD-02-002005 | コンテキストメニュー設定 | BD-02-005002 | フロー一覧操作 |  |
| DD-02-002005 | コンテキストメニュー設定 | DDUT-02-002005-00001 | refresh 変更イベント発火 |  |
| DD-02-003001 | FlowEditorManager 概要 | BD-02-003001 | FlowEditorManager 概要 |  |
| DD-02-003002 | FlowEditorManager クラス設計 | BD-02-003002 | IFlowEditorManager インターフェース |  |
| DD-02-003003 | openEditor 実装 | BD-02-003003 | パネルライフサイクル |  |
| DD-02-003003 | openEditor 実装 | DDUT-02-003003-00001 | openEditor 新規パネル作成 |  |
| DD-02-003003 | openEditor 実装 | DDUT-02-003003-00002 | openEditor 既存パネル reveal |  |
| DD-02-003004 | HTML 生成 | BD-02-003004 | WebviewPanel のオプション設計 |  |
| DD-02-003004 | HTML 生成 | DDUT-02-003004-00001 | openEditor CSP 付き HTML 設定 |  |
| DD-02-003005 | パネルライフサイクル | BD-02-003003 | パネルライフサイクル |  |
| DD-02-003005 | パネルライフサイクル | BD-02-003005 | MessageBroker との連携 |  |
| DD-02-003005 | パネルライフサイクル | DDUT-02-003005-00001 | dispose 全パネル解放 |  |
| DD-02-004001 | FlowEditorApp 概要 | BD-02-004001 | コンポーネント階層 |  |
| DD-02-004002 | ステート管理 | BD-02-004002 | FlowEditorApp |  |
| DD-02-004002 | ステート管理 | DDUT-02-004002-00001 | 初期状態 nodes/edges 空 |  |
| DD-02-004002 | ステート管理 | DDUT-02-004002-00002 | 初期状態 isDirty false |  |
| DD-02-004003 | メッセージハンドリング | BD-02-004002 | FlowEditorApp |  |
| DD-02-004003 | メッセージハンドリング | BD-02-005001 | 主要操作フロー |  |
| DD-02-004003 | メッセージハンドリング | DDUT-02-004003-00001 | マウント時 flow:load メッセージ送信 |  |
| DD-02-005001 | Toolbar コンポーネント設計 | BD-02-004003 | Toolbar |  |
| DD-02-005001 | Toolbar コンポーネント設計 | DDUT-02-005001-00001 | isRunning 時 実行ボタン disabled |  |
| DD-02-005001 | Toolbar コンポーネント設計 | DDUT-02-005001-00002 | isDirty false 時 保存ボタン disabled |  |
| DD-02-006001 | NodePalette コンポーネント設計 | BD-02-004004 | NodePalette |  |
| DD-02-006001 | NodePalette コンポーネント設計 | DDUT-02-006001-00001 | ノード種別カテゴリ別表示 |  |
| DD-02-006002 | ドラッグ&ドロップ | BD-02-004004 | NodePalette |  |
| DD-02-006002 | ドラッグ&ドロップ | BD-02-005003 | エディタ操作 |  |
| DD-02-007001 | FlowCanvas 概要 | BD-02-004005 | FlowCanvas |  |
| DD-02-007002 | React Flow 設定 | BD-02-004005 | FlowCanvas |  |
| DD-02-007003 | CustomNodeComponent | BD-02-004005 | FlowCanvas |  |
| DD-02-007004 | コンテキストメニュー | BD-02-004005 | FlowCanvas |  |
| DD-02-007005 | Undo/Redo | BD-02-004005 | FlowCanvas |  |
| DD-02-007005 | Undo/Redo | BD-02-005003 | エディタ操作 |  |
| DD-02-007005 | Undo/Redo | DDUT-02-007005-00001 | 初期状態 canUndo false |  |
| DD-02-007005 | Undo/Redo | DDUT-02-007005-00002 | pushState 後 canUndo true |  |
| DD-02-007005 | Undo/Redo | DDUT-02-007005-00003 | undo 後 canRedo true |  |
| DD-02-008001 | PropertyPanel 概要 | BD-02-004006 | PropertyPanel |  |
| DD-02-008001 | PropertyPanel 概要 | DDUT-02-008001-00001 | ノード未選択時プレースホルダー表示 |  |
| DD-02-008002 | SettingsTab | BD-02-004006 | PropertyPanel |  |
| DD-02-008003 | OutputTab | BD-02-004006 | PropertyPanel |  |
| DD-02-009001 | MessageClient 概要 | BD-02-004007 | MessageClient |  |
| DD-02-009002 | シングルトン設計 | BD-02-004007 | MessageClient |  |
| DD-02-009002 | シングルトン設計 | DDUT-02-009002-00001 | send で postMessage 呼び出し |  |
| DD-02-009002 | シングルトン設計 | DDUT-02-009002-00002 | onMessage リスナー登録 |  |
| DD-02-009002 | シングルトン設計 | DDUT-02-009002-00003 | onMessage dispose でリスナー解除 |  |
| DD-03-002001 | NodeExecutorRegistry 概要 | BD-03-003001 | NodeExecutorRegistry 概要 |  |
| DD-03-002002 | クラス設計 | BD-03-003002 | INodeExecutorRegistry インターフェース |  |
| DD-03-002003 | メソッド詳細 | BD-03-003002 | INodeExecutorRegistry インターフェース |  |
| DD-03-002003 | NodeExecutorRegistry メソッド詳細 | DDUT-03-002003-00001 | 新規ノード型の登録成功 |  |
| DD-03-002003 | NodeExecutorRegistry メソッド詳細 | DDUT-03-002003-00002 | 重複登録で例外 |  |
| DD-03-002003 | NodeExecutorRegistry メソッド詳細 | DDUT-03-002003-00003 | 登録済み型から Executor 取得 |  |
| DD-03-002003 | NodeExecutorRegistry メソッド詳細 | DDUT-03-002003-00004 | 未登録型で例外 |  |
| DD-03-002003 | NodeExecutorRegistry メソッド詳細 | DDUT-03-002003-00005 | getAll で全 Executor 返却 |  |
| DD-03-002003 | NodeExecutorRegistry メソッド詳細 | DDUT-03-002003-00006 | has 登録済みで true |  |
| DD-03-002003 | NodeExecutorRegistry メソッド詳細 | DDUT-03-002003-00007 | has 未登録で false |  |
| DD-03-002004 | registerBuiltinExecutors 関数 | BD-03-003003 | 初期化と登録フロー |  |
| DD-03-002004 | ビルトイン Executor 登録 | DDUT-03-002004-00001 | registerBuiltinExecutors 11 種登録 |  |
| DD-03-003001 | FlowRepository 概要 | BD-03-005005 | IFlowRepository インターフェース |  |
| DD-03-003002 | FlowRepository クラス設計 | BD-03-005005 | IFlowRepository インターフェース |  |
| DD-03-003003 | メソッド詳細 | BD-03-005005 | IFlowRepository インターフェース |  |
| DD-03-003003 | FlowRepository メソッド詳細 | DDUT-03-003003-00001 | save で JSON ファイル書き込み |  |
| DD-03-003003 | FlowRepository メソッド詳細 | DDUT-03-003003-00002 | load 既存フロー返却 |  |
| DD-03-003003 | FlowRepository メソッド詳細 | DDUT-03-003003-00003 | load 非既存で例外 |  |
| DD-03-003003 | FlowRepository メソッド詳細 | DDUT-03-003003-00004 | delete 既存フロー削除 |  |
| DD-03-003003 | FlowRepository メソッド詳細 | DDUT-03-003003-00005 | delete 非既存で例外 |  |
| DD-03-003003 | FlowRepository メソッド詳細 | DDUT-03-003003-00006 | list 更新日時降順返却 |  |
| DD-03-003003 | FlowRepository メソッド詳細 | DDUT-03-003003-00007 | exists 既存で true |  |
| DD-03-003003 | FlowRepository メソッド詳細 | DDUT-03-003003-00008 | exists 非既存で false |  |
| DD-03-003004 | ヘルパーメソッド | BD-03-005005 | IFlowRepository インターフェース |  |
| DD-03-003004 | セキュリティ考慮 | DDUT-03-003004-00001 | パストラバーサル ".." で例外 |  |
| DD-03-003004 | セキュリティ考慮 | DDUT-03-003004-00002 | パストラバーサル "/" で例外 |  |
| DD-03-003004 | セキュリティ考慮 | DDUT-03-003004-00003 | ensureBaseDir ディレクトリ作成 |  |
| DD-03-003005 | セキュリティ考慮事項 | BD-03-005005 | IFlowRepository インターフェース |  |
| DD-03-004001 | 共通実装パターン | BD-03-002002 | INodeExecutor メソッド定義 |  |
| DD-03-004002 | テンプレート展開ヘルパー | BD-03-002002 | INodeExecutor メソッド定義 |  |
| DD-03-004002 | テンプレート展開ヘルパー | DDUT-03-004002-00001 | 文字列入力でプレースホルダー置換 |  |
| DD-03-004002 | テンプレート展開ヘルパー | DDUT-03-004002-00002 | オブジェクト入力で JSON.stringify |  |
| DD-03-004002 | テンプレート展開ヘルパー | DDUT-03-004002-00003 | プレースホルダーなしで変更なし |  |
| DD-03-004002 | テンプレート展開ヘルパー | DDUT-03-004002-00004 | 複数プレースホルダーで全置換 |  |
| DD-03-005001 | TriggerExecutor | BD-03-006001 | TriggerExecutor |  |
| DD-03-005001 | TriggerExecutor | DDUT-03-005001-00001 | TriggerExecutor validate 常に valid |  |
| DD-03-005001 | TriggerExecutor | DDUT-03-005001-00002 | TriggerExecutor execute 空出力 |  |
| DD-03-005002 | CommandExecutor | BD-03-006002 | CommandExecutor |  |
| DD-03-005002 | CommandExecutor | DDUT-03-005002-00001 | CommandExecutor validate コマンドなし |  |
| DD-03-005002 | CommandExecutor | DDUT-03-005002-00002 | CommandExecutor execute exit 0 成功 |  |
| DD-03-005002 | CommandExecutor | DDUT-03-005002-00003 | CommandExecutor execute 非ゼロ エラー |  |
| DD-03-005003 | LogExecutor | BD-03-006006 | LogExecutor |  |
| DD-03-005003 | LogExecutor | DDUT-03-005003-00001 | LogExecutor validate レベルなし |  |
| DD-03-005003 | LogExecutor | DDUT-03-005003-00002 | LogExecutor execute info ログ出力 |  |
| DD-03-005003 | LogExecutor | DDUT-03-005003-00003 | LogExecutor execute 入力パススルー |  |
| DD-03-006001 | AIPromptExecutor | BD-03-006003 | AIPromptExecutor |  |
| DD-03-006001 | AIPromptExecutor | DDUT-03-006001-00001 | AIPromptExecutor validate 空プロンプト |  |
| DD-03-006001 | AIPromptExecutor | DDUT-03-006001-00002 | AIPromptExecutor validate モデルなし |  |
| DD-03-007001 | ConditionExecutor | BD-03-006004 | ConditionExecutor |  |
| DD-03-007001 | ConditionExecutor | DDUT-03-007001-00001 | ConditionExecutor validate 式なし |  |
| DD-03-007001 | ConditionExecutor | DDUT-03-007001-00002 | ConditionExecutor 真 → true 分岐 |  |
| DD-03-007001 | ConditionExecutor | DDUT-03-007001-00003 | ConditionExecutor 偽 → false 分岐 |  |
| DD-03-007001 | ConditionExecutor | DDUT-03-007001-00004 | ConditionExecutor 構文エラー |  |
| DD-03-007002 | LoopExecutor | BD-03-006005 | LoopExecutor |  |
| DD-03-007002 | LoopExecutor | DDUT-03-007002-00001 | LoopExecutor validate モードなし |  |
| DD-03-007002 | LoopExecutor | DDUT-03-007002-00002 | LoopExecutor count モード N 回反復 |  |
| DD-03-007002 | LoopExecutor | DDUT-03-007002-00003 | LoopExecutor list モード非配列エラー |  |
| DD-03-007003 | SubFlowExecutor | BD-03-006011 | SubFlowExecutor |  |
| DD-03-007003 | SubFlowExecutor | DDUT-03-007003-00001 | SubFlowExecutor validate flowId なし |  |
| DD-03-008001 | FileExecutor | BD-03-006007 | FileExecutor |  |
| DD-03-008001 | FileExecutor | DDUT-03-008001-00001 | FileExecutor validate パスなし |  |
| DD-03-008001 | FileExecutor | DDUT-03-008001-00002 | FileExecutor validate 絶対パス拒否 |  |
| DD-03-008001 | FileExecutor | DDUT-03-008001-00003 | FileExecutor validate ".." 拒否 |  |
| DD-03-008002 | HttpExecutor | BD-03-006008 | HttpExecutor |  |
| DD-03-008002 | HttpExecutor | DDUT-03-008002-00001 | HttpExecutor validate URL なし |  |
| DD-03-008003 | TransformExecutor | BD-03-006009 | TransformExecutor |  |
| DD-03-008003 | TransformExecutor | DDUT-03-008003-00001 | TransformExecutor validate 式なし |  |
| DD-03-008003 | TransformExecutor | DDUT-03-008003-00002 | TransformExecutor JSON.parse 実行 |  |
| DD-03-009001 | CommentExecutor | BD-03-006010 | CommentExecutor |  |
| DD-03-009001 | CommentExecutor | DDUT-03-009001-00001 | CommentExecutor validate 常に valid |  |
| DD-03-009001 | CommentExecutor | DDUT-03-009001-00002 | CommentExecutor execute skipped |  |
| DD-04-002001 | ExecutionService 概要 | BD-04-002001 | ExecutionService 概要 |  |
| DD-04-002002 | ExecutionService クラス設計 | BD-04-002002 | IExecutionService インターフェース |  |
| DD-04-002003 | トポロジカルソート | BD-04-002003 | 実行フロー詳細 |  |
| DD-04-002003 | トポロジカルソート | DDUT-04-002003-00001 | topologicalSort 線形チェーン |  |
| DD-04-002003 | トポロジカルソート | DDUT-04-002003-00002 | topologicalSort 単一ノード |  |
| DD-04-002003 | トポロジカルソート | DDUT-04-002003-00003 | topologicalSort ダイヤモンド |  |
| DD-04-002003 | トポロジカルソート | DDUT-04-002003-00004 | topologicalSort 循環参照で例外 |  |
| DD-04-002003 | トポロジカルソート | DDUT-04-002003-00005 | topologicalSort 非接続ノード含む |  |
| DD-04-002004 | 実行ループ | BD-04-002003 | 実行フロー詳細 |  |
| DD-04-002004 | executeFlow メソッド | DDUT-04-002004-00001 | executeFlow 正常フロー完了 |  |
| DD-04-002004 | executeFlow メソッド | DDUT-04-002004-00002 | executeFlow 既に実行中で例外 |  |
| DD-04-002004 | executeFlow メソッド | DDUT-04-002004-00003 | executeFlow 不明フローで例外 |  |
| DD-04-002004 | executeFlow メソッド | DDUT-04-002004-00004 | executeFlow disabled ノードスキップ |  |
| DD-04-002004 | executeFlow メソッド | DDUT-04-002004-00005 | executeFlow Executor 未登録で例外 |  |
| DD-04-002004 | executeFlow メソッド | DDUT-04-002004-00006 | executeFlow validate 失敗で中断 |  |
| DD-04-002004 | executeFlow メソッド | DDUT-04-002004-00007 | executeFlow 例外時クリーンアップ |  |
| DD-04-002004 | executeFlow メソッド | DDUT-04-002004-00008 | executeFlow イベント発火 |  |
| DD-04-002005 | 入力データ構築 | BD-04-002004 | データ伝播 |  |
| DD-04-002005 | buildInputs | DDUT-04-002005-00001 | buildInputs 単一エッジ |  |
| DD-04-002005 | buildInputs | DDUT-04-002005-00002 | buildInputs 複数エッジ |  |
| DD-04-002005 | buildInputs | DDUT-04-002005-00003 | buildInputs 入力なし |  |
| DD-04-002005 | buildInputs | DDUT-04-002005-00004 | buildInputs ソース出力なし |  |
| DD-04-002006 | フロー停止 | BD-04-002005 | フロー停止 |  |
| DD-04-002006 | stopFlow メソッド | DDUT-04-002006-00001 | stopFlow 実行中フロー停止 |  |
| DD-04-002006 | stopFlow メソッド | DDUT-04-002006-00002 | stopFlow 非実行中で no-op |  |
| DD-04-002007 | エラーポリシー | BD-04-002006 | エラーポリシー |  |
| DD-04-002007 | エラーハンドリングポリシー | DDUT-04-002007-00001 | handleNodeError stopOnError ポリシー |  |
| DD-04-002008 | 実行時フィードバック | BD-04-002007 | 実行時フィードバック |  |
| DD-04-002008 | 実行フィードバック | DDUT-04-002008-00001 | 実行フィードバック nodeStarted |  |
| DD-04-002008 | 実行フィードバック | DDUT-04-002008-00002 | 実行フィードバック nodeCompleted |  |
| DD-04-002009 | SubFlowExecutor との連携（再帰的実行） | BD-04-002003 | 実行フロー詳細 |  |
| DD-04-002009 | サブフロー再帰制御 | DDUT-04-002009-00001 | サブフロー深度超過で例外 |  |
| DD-04-003001 | DebugService 概要 | BD-04-003001 | DebugService 概要 |  |
| DD-04-003002 | DebugService クラス設計 | BD-04-003002 | IDebugService インターフェース |  |
| DD-04-003003 | デバッグ開始 | BD-04-003003 | デバッグ実行フロー |  |
| DD-04-003003 | startDebug メソッド | DDUT-04-003003-00001 | startDebug 有効フローで開始 |  |
| DD-04-003003 | startDebug メソッド | DDUT-04-003003-00002 | startDebug 既にアクティブで例外 |  |
| DD-04-003003 | startDebug メソッド | DDUT-04-003003-00003 | startDebug 不明フローで例外 |  |
| DD-04-003003 | startDebug メソッド | DDUT-04-003003-00004 | startDebug 初期順序構築 |  |
| DD-04-003004 | ステップ実行 | BD-04-003003 | デバッグ実行フロー |  |
| DD-04-003004 | step メソッド | DDUT-04-003004-00001 | step 最初のノード実行 |  |
| DD-04-003004 | step メソッド | DDUT-04-003004-00002 | step 全ノード順次実行 |  |
| DD-04-003004 | step メソッド | DDUT-04-003004-00003 | step 非アクティブ時 no-op |  |
| DD-04-003004 | step メソッド | DDUT-04-003004-00004 | step エラー時リカバリー |  |
| DD-04-003004 | step メソッド | DDUT-04-003004-00005 | step 最終ノードで完了 |  |
| DD-04-003005 | 中間結果管理 | BD-04-003004 | 中間結果 |  |
| DD-04-003005 | 中間結果 | DDUT-04-003005-00001 | step 後に中間結果返却 |  |
| DD-04-003006 | 条件分岐・ループ | BD-04-003005 | 条件分岐・ループの扱い |  |
| DD-04-003006 | 条件分岐ハンドリング | DDUT-04-003006-00001 | 条件分岐で正しいパス選択 |  |
| DD-04-004001 | HistoryService 概要 | BD-04-004001 | HistoryService 概要 |  |
| DD-04-004002 | HistoryService クラス設計 | BD-04-004002 | IHistoryService インターフェース |  |
| DD-04-004003 | メソッド詳細（cleanupOldRecords） | BD-04-004005 | 保持件数管理 |  |
| DD-04-004003 | HistoryService メソッド詳細 | DDUT-04-004003-00001 | saveRecord レコード永続化 |  |
| DD-04-004003 | HistoryService メソッド詳細 | DDUT-04-004003-00002 | getRecords リポジトリ委譲 |  |
| DD-04-004003 | HistoryService メソッド詳細 | DDUT-04-004003-00003 | getRecord ID 指定取得 |  |
| DD-04-004003 | HistoryService メソッド詳細 | DDUT-04-004003-00004 | deleteRecord リポジトリ委譲 |  |
| DD-04-004003 | HistoryService メソッド詳細 | DDUT-04-004003-00005 | cleanupOldRecords maxCount=-1 スキップ |  |
| DD-04-004003 | HistoryService メソッド詳細 | DDUT-04-004003-00006 | cleanupOldRecords maxCount=0 全削除 |  |
| DD-04-004003 | HistoryService メソッド詳細 | DDUT-04-004003-00007 | cleanupOldRecords 件数以下で削除なし |  |
| DD-04-004003 | HistoryService メソッド詳細 | DDUT-04-004003-00008 | cleanupOldRecords 超過分を古い順に削除 |  |
| DD-04-005001 | HistoryRepository 概要 | BD-04-004004 | IHistoryRepository インターフェース |  |
| DD-04-005002 | HistoryRepository クラス設計 | BD-04-004004 | IHistoryRepository インターフェース |  |
| DD-04-005003 | ファイルシステム構造 | BD-04-004004 | IHistoryRepository インターフェース |  |
| DD-04-005003 | セキュリティ考慮 | DDUT-04-005003-00001 | パストラバーサル ".." で例外 |  |
| DD-04-005004 | メソッド詳細 | BD-04-004004 | IHistoryRepository インターフェース |  |
| DD-04-005004 | HistoryRepository メソッド詳細 | DDUT-04-005004-00001 | save ディレクトリ作成・JSON 書き込み |  |
| DD-04-005004 | HistoryRepository メソッド詳細 | DDUT-04-005004-00002 | load JSON 読み込み・パース |  |
| DD-04-005004 | HistoryRepository メソッド詳細 | DDUT-04-005004-00003 | list ソート済みサマリー返却 |  |
| DD-04-005004 | HistoryRepository メソッド詳細 | DDUT-04-005004-00004 | delete ファイル削除 |  |
| DD-04-005004 | HistoryRepository メソッド詳細 | DDUT-04-005004-00005 | count JSON ファイル数返却 |  |
| DD-04-005004 | HistoryRepository メソッド詳細 | DDUT-04-005004-00006 | count 空ディレクトリで 0 返却 |  |
| DD-04-006001 | 通知ハンドラ | BD-04-005001 | 通知設計 |  |
| DD-04-006001 | 通知ハンドラ | DDUT-04-006001-00001 | 成功通知 showInformationMessage |  |
| DD-04-006001 | 通知ハンドラ | DDUT-04-006001-00002 | エラー通知 showErrorMessage |  |
| DD-04-006001 | 通知ハンドラ | DDUT-04-006001-00003 | キャンセル通知 showWarningMessage |  |
| DD-04-006002 | 通知アクション | BD-04-005002 | 通知アクション |  |
| DD-04-006002 | 通知アクション | DDUT-04-006002-00001 | 成功時 "履歴を表示" アクション |  |
| DD-04-006002 | 通知アクション | DDUT-04-006002-00002 | エラー時 "詳細を表示" アクション |  |
