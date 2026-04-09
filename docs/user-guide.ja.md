# FlowRunner ユーザーガイド

## 概要

FlowRunner は Visual Studio Code 向けのノードベース ワークフロー実行拡張機能です。ビジュアルエディタでワークフローを設計し、ノードを接続して、エディタから直接実行できます。

## はじめに

1. VS Code を開き、FlowRunner 拡張機能をインストール
2. アクティビティバー（左サイドバー）の **FlowRunner** アイコンをクリック
3. フローリストパネルの **Create Flow** をクリックし、**Blank Flow** / **Starter Template** / **Recent Template** から開始方法を選択
4. ビジュアルエディタでワークフローを設計
5. **Execute**（▶）をクリックしてフローを実行

## フローエディタ

### キャンバス

- **パン（移動）**: 右クリックドラッグ またはスクロールホイール
- **ズーム**: Ctrl/Cmd + スクロールホイール
- **ノード追加**: ノードパレット（左パネル）からノードをドラッグ
- **ノード接続**: 出力ポートから入力ポートへドラッグ
- **接続解除**: エッジを選択して Delete キー
- **各入力ポートは1つの接続のみ受け付けます** — 新しいエッジを接続すると既存の接続が置き換わります

### 選択 & クリップボード

| ショートカット | 操作 |
|----------|--------|
| クリック | ノードを1つ選択 |
| Shift + クリック | 選択にノードを追加/除外 |
| ドラッグ（キャンバス上） | 矩形選択 |
| Cmd/Ctrl + A | 全ノード選択 |
| Cmd/Ctrl + C | 選択ノード＆エッジをコピー |
| Cmd/Ctrl + V | ペースト |
| Cmd/Ctrl + X | カット |
| Cmd/Ctrl + D | 複製 |
| Delete / Backspace | 選択ノードを削除 |
| Escape | 選択解除 |
| Cmd/Ctrl + Z | 元に戻す |
| Cmd/Ctrl + Shift + Z | やり直し |

> テキストフィールド（input, textarea, select）の編集中はショートカットが無効になります。

### ツールバー

| ボタン | 動作 |
|--------|--------|
| ▶ Execute | フローを保存して実行 |
| 🐛 Debug | フローを保存してデバッグモードで実行 |
| ⇶ Auto Layout (LR) | ノードを自動整列（左→右）。ノードを2つ以上選択中は選択ノードのみ対象 |
| ⇵ Auto Layout (TB) | ノードを自動整列（上→下）。ノードを2つ以上選択中は選択ノードのみ対象 |
| ┃ Align X | 選択ノードのX座標を揃える（縦一列に整列） |
| ━ Align Y | 選択ノードのY座標を揃える（横一列に整列） |

### コンテキストメニュー

キャンバス、ノード、エッジを右クリックすると、Auto Layout、削除などのコンテキストメニューが表示されます。

### 右サイドバー

右サイドバーには、実行状況の可視化とノード詳細がまとまって表示されます。

- **Latest Execution Summary** — 最新実行の各ノードを実行順に表示し、status、duration、1 行要約を確認できます。項目クリックでノード選択とフォーカスが行われます。
- **Execution Analytics** — 直近実行の成功 / 失敗件数、成功率、平均実行時間、recent failures、slowest node を表示します。
- **Flow Dependencies** — 呼び出し先 / 呼び出し元の subflow 関係と依存 warning を表示します。
- **Property Panel** — ノード選択時は同じ右サイドバー内に、対象ノードの **Settings** セクションと **Output** セクションが折りたたみ可能な形で表示されます。

---

## ノードの種類

### 基本ノード

#### Trigger（トリガー）

フローの開始点です。最初のノードとして必要です。

| 設定項目 | 説明 |
|---------|-------------|
| トリガー種別 | **Manual**（デフォルト）、**File Change Watch**、**Schedule** |
| ファイルパターン | ファイル監視用の Glob パターン（例: `**/*.ts`） |
| デバウンス (ms) | 連続するファイル変更の遅延（デフォルト: 500） |
| インターバル (秒) | スケジュール実行の間隔（デフォルト: 60、最小: 5） |

#### Command（コマンド実行）

シェルコマンドを実行します。

| 設定項目 | 説明 |
|---------|-------------|
| コマンド | 実行するシェルコマンド。`{{input}}`、`{{vars.xxx}}` テンプレートに対応 |
| 作業ディレクトリ | コマンド実行ディレクトリ |
| シェル | 使用するシェル（default, bash, zsh, sh, cmd, pwsh） |
| 環境変数 | 環境変数のキー・値ペア |
| タイムアウト (秒) | 実行タイムアウト（0 = 無制限） |

出力ポート: **stdout**、**stderr**

#### Log（ログ出力）

FlowRunner の出力チャネルにメッセージを出力します。

| 設定項目 | 説明 |
|---------|-------------|
| メッセージ | ログメッセージ。`{{input}}`、`{{input.xxx}}`、`{{vars.xxx}}` テンプレートに対応 |
| レベル | info, warn, error |

### 制御ノード

#### Condition（条件分岐）

式に基づいてフローを分岐します。

| 設定項目 | 説明 |
|---------|-------------|
| 式 | jexl 式。`input` および `vars.xxx` が利用可能 |

出力ポート: **True**、**False**

式の例:
- `input.length > 0`
- `input.status === "ok"`
- `vars.count > 10`

#### Loop（ループ）

下流ノードの実行を繰り返します。

| 設定項目 | 説明 |
|---------|-------------|
| ループ種別 | **Count**（N 回）、**Condition**（while）、**List**（forEach） |
| 回数 | 反復回数（body にはインデックス 0, 1, 2, ... が渡されます） |
| 式 | condition/list モード用の jexl 式。`input`、`index`、`vars.xxx` が利用可能 |

出力ポート: **body**（ループ反復）、**done**（ループ完了後）

#### Parallel（並列実行）

複数のブランチを同時に実行します。

出力ポート: **branch1**、**branch2**、**branch3**、**done**（全ブランチ完了後）

#### SubFlow（サブフロー）

別のフローをサブフローとして実行します。

| 設定項目 | 説明 |
|---------|-------------|
| フロー | 実行するフローを選択 |
| 出力ノード | 出力として使用するターミナルノードを選択（オプション） |

#### TryCatch（例外処理）

エラーハンドリングのラッパーです。

出力ポート: **try**（正常実行）、**catch**（エラー時）、**done**（常に実行）

### データノード

#### HTTP Request（HTTPリクエスト）

HTTP リクエストを送信します。

| 設定項目 | 説明 |
|---------|-------------|
| URL | リクエスト URL。`{{input}}`、`{{vars.xxx}}` テンプレートに対応 |
| メソッド | GET, POST, PUT, DELETE, PATCH |
| ヘッダー | キー・値ペア |
| ボディ | リクエストボディ。テンプレートに対応 |
| 認証 | none, bearer |
| トークン | Bearer トークン |
| タイムアウト (秒) | リクエストタイムアウト（デフォルト: 30） |

出力ポート: **body**（レスポンス）、**status**（ステータスコード）

#### File（ファイル操作）

ファイルシステム操作を行います。

| 設定項目 | 説明 |
|---------|-------------|
| 操作種別 | read, write, append, delete, exists, listDir |
| パス | ファイルパス。`{{input}}`、`{{vars.xxx}}` テンプレートに対応 |
| エンコーディング | utf-8, ascii, base64 |

#### Transform（データ変換）

データ変換操作を行います。

| 設定項目 | 説明 |
|---------|-------------|
| 変換種別 | jsonParse, jsonStringify, textReplace, textSplit, textJoin, regex, template, jsExpression, **setVar**, **getVar** |
| 式 | テンプレートまたは jexl 式 |
| 変数名 | setVar/getVar: 共有変数名 |
| デフォルト値 | getVar: フォールバック値 |

### AI ノード

#### AI Prompt（AIプロンプト）

VS Code で利用可能な AI 言語モデルにプロンプトを送信します。

| 設定項目 | 説明 |
|---------|-------------|
| プロンプト | プロンプトテキスト。`{{input}}`、`{{input.xxx}}`、`{{vars.xxx}}` テンプレートに対応 |
| モデル | 利用可能な言語モデルから選択 |

出力ポート: **response**（AI 応答テキスト）、**token usage**（使用量統計）

### その他

#### Comment（コメント）

実行されない注釈ノードです。ドキュメント用途に使用します。

---

## テンプレート構文

多くのノードが動的な値のためのテンプレート文字列をサポートしています:

| テンプレート | 説明 | 例 |
|----------|-------------|---------|
| `{{input}}` | 前のノードの出力（全体の値） | `echo {{input}}` |
| `{{input.xxx}}` | 前のノードの出力のプロパティ | `{{input.name}}` |
| `{{vars.xxx}}` | 共有変数（Transform の setVar で設定） | `{{vars.apiKey}}` |

## 式の構文（jexl）

Condition、Loop（condition モード）、Transform（jsExpression）ノードは **jexl** 式を使用します:

```
input.length > 0
input.status === "ok"
vars.count > 10
input|upper
input|length > 5
```

利用可能な変換: `length`、`upper`、`lower`、`trim`、`keys`、`values`、`string`、`number`

---

## 共有変数

**Transform** ノードの `setVar`/`getVar` を使ってノード間でデータを共有できます:

1. **Transform** ノードを追加し、種別を **setVar** に設定
2. **変数名** を設定（例: `myData`）
3. 入力値が共有変数として保存されます
4. 後続のノードはテンプレートで `{{vars.myData}}`、式で `vars.myData` としてアクセス可能
5. **getVar** を使用すると変数の値をノード出力として取得できます

---

## トリガー

### Manual（手動）
デフォルトモードです。Execute をクリックするとフローが実行されます。

### File Change Watch（ファイル変更監視）
Glob パターンに一致するファイルが変更されると、フローが自動実行されます。

1. **トリガー種別** を "File Change Watch" に設定
2. **ファイルパターン** を設定（例: `**/*.ts`）
3. フローリストでフローを右クリック → **Activate Trigger**
4. 一致するファイルが変更されるとフローが実行されます
5. 右クリック → **Deactivate Trigger** で停止

### Schedule（スケジュール）
一定間隔でフローが実行されます。

1. **トリガー種別** を "Schedule" に設定
2. **インターバル** を秒単位で設定
3. 右クリックのコンテキストメニューから有効化

---

## デバッグモード

1. ツールバーの 🐛 **Debug** をクリック
2. フローがステップ実行されます
3. **Step** で次のノードに進む
4. 実行中に中間結果が表示されます
5. **Stop** でデバッグセッションを終了

---

## フロー管理

### コマンド（コマンドパレット）

| コマンド | 説明 |
|---------|-------------|
| FlowRunner: Create Flow | Blank Flow / Starter Template / Recent Template の作成方法を選択する |
| FlowRunner: Create Flow from Template | テンプレート選択を直接開く |
| FlowRunner: Save Flow as Template | 現在のフローを再利用可能なテンプレートとして保存 |
| FlowRunner: Duplicate Flow | 選択中のフローを新しい ID で複製 |
| FlowRunner: Export Flow | フローを JSON ファイルにエクスポート |
| FlowRunner: Import Flow | JSON ファイルからフローをインポート |
| FlowRunner: Execute Flow | 現在のフローを実行 |
| FlowRunner: Debug Flow | デバッグモードを開始 |

### Copilot Chat 連携

Copilot Chat で `@flowrunner` を使用:

- `@flowrunner /run <フロー名>` — 名前でフローを実行
- `@flowrunner /list` — 利用可能なフローを一覧表示
- `@flowrunner /create <説明>` — 自然言語の説明からフローを作成

---

## 設定

| 設定 | 説明 | デフォルト |
|---------|-------------|---------|
| `flowrunner.autoSave` | フロー定義の自動保存 | `true` |
| `flowrunner.historyMaxCount` | フローあたりの最大実行履歴数 | `50` |

---

## 実行履歴

過去の実行結果はフローリストパネルから確認できます。各レコードには以下が含まれます:
- 実行タイムスタンプ
- ステータス（成功/エラー）
- 実行時間
- ノードごとの結果と出力
