# FEAT-00001: イベント/スケジュールトリガー

- 対応する RD 参照: RD-01 §10 #1（ファイル変更監視・タイマーによる自動実行）

## 概要

トリガーノードに「手動実行」以外のトリガー種別（ファイル変更監視・スケジュール実行）を追加し、外部イベントに応じてフローを自動実行できるようにする。

## スコープ (FEAT-00001-002000)

### 実装する範囲

- TriggerExecutor の settingsSchema 拡張（トリガー種別・設定項目の追加）
- ITriggerService インターフェースと TriggerService 実装
- ファイル変更トリガー（vscode.workspace.createFileSystemWatcher）
- スケジュールトリガー（setInterval ベース）
- トリガーの有効化/無効化コマンド
- extensionMain.ts へのライフサイクル統合

### スコープ外

- cron 式によるスケジュール（v1 ではインターバル秒指定のみ）
- WebView 上のトリガー状態表示 UI（ステータスバーのみ対応）
- 複数トリガーの AND/OR 組み合わせ
- 外部 Webhook トリガー

## 仕様

### §3.1 トリガー種別 (FEAT-00001-003001)

トリガーノードは以下の3種別をサポートする:

| triggerType | 説明 | 実行契機 |
|---|---|---|
| `manual` | 手動実行（既存動作） | ユーザーの明示的な実行コマンド |
| `fileChange` | ファイル変更監視 | 監視対象ファイルの作成・変更・削除 |
| `schedule` | スケジュール実行 | 指定間隔（秒）ごとの定期実行 |

`manual` はデフォルト値であり、既存フローの後方互換性を維持する。

### §3.2 TriggerExecutor 設定スキーマ (FEAT-00001-003002)

TriggerExecutor の `settingsSchema` を以下のように拡張する:

```typescript
settingsSchema: [
  {
    key: "triggerType",
    label: "トリガー種別",
    type: "select",
    required: true,
    defaultValue: "manual",
    options: [
      { value: "manual", label: "手動実行" },
      { value: "fileChange", label: "ファイル変更監視" },
      { value: "schedule", label: "スケジュール実行" },
    ],
  },
  {
    key: "filePattern",
    label: "監視パターン",
    type: "string",
    required: true,
    placeholder: "**/*.ts",
    description: "glob パターンで監視対象ファイルを指定",
    visibleWhen: { field: "triggerType", value: "fileChange" },
  },
  {
    key: "debounceMs",
    label: "デバウンス (ms)",
    type: "number",
    required: false,
    defaultValue: 500,
    description: "連続変更時の実行遅延（ミリ秒）",
    visibleWhen: { field: "triggerType", value: "fileChange" },
  },
  {
    key: "intervalSeconds",
    label: "実行間隔 (秒)",
    type: "number",
    required: true,
    defaultValue: 60,
    description: "定期実行の間隔（秒）。最小値: 5",
    visibleWhen: { field: "triggerType", value: "schedule" },
  },
]
```

### §3.3 TriggerExecutor 出力データ (FEAT-00001-003003)

トリガー種別に応じて出力ポートに渡すデータを変更する:

```typescript
// manual — 既存動作維持
{ out: {} }

// fileChange
{
  out: {
    filePath: string;      // 変更されたファイルの URI 文字列
    changeType: "created" | "changed" | "deleted";
  }
}

// schedule
{
  out: {
    triggeredAt: string;   // ISO 8601 タイムスタンプ
  }
}
```

TriggerExecutor の `execute()` は `context.triggerData` を受け取り、そのまま出力へ渡す。`triggerData` が未設定の場合は `manual` 動作（`{ out: {} }`）にフォールバックする。

### §3.4 ITriggerService インターフェース (FEAT-00001-003004)

```typescript
// src/extension/interfaces/ITriggerService.ts
import type { Disposable } from "./IExecutionService.js";

export interface TriggerConfig {
  triggerType: "manual" | "fileChange" | "schedule";
  filePattern?: string;
  debounceMs?: number;
  intervalSeconds?: number;
}

export interface TriggerInfo {
  flowId: string;
  config: TriggerConfig;
  active: boolean;
}

export interface ITriggerService extends Disposable {
  /** トリガーを有効化する */
  activateTrigger(flowId: string, config: TriggerConfig): void;

  /** トリガーを無効化する */
  deactivateTrigger(flowId: string): void;

  /** 全トリガーを無効化する */
  deactivateAll(): void;

  /** アクティブなトリガー一覧を返す */
  getActiveTriggers(): TriggerInfo[];

  /** 指定フローのトリガーがアクティブか */
  isActive(flowId: string): boolean;
}
```

### §3.5 TriggerService 実装 (FEAT-00001-003005)

TriggerService は ITriggerService を実装し、以下の責務を持つ:

1. **ファイル変更監視**: `vscode.workspace.createFileSystemWatcher` でグロブパターンを監視し、デバウンス付きで ExecutionService.executeFlow を呼び出す
2. **スケジュール実行**: `setInterval` で定期的に ExecutionService.executeFlow を呼び出す
3. **ライフサイクル管理**: 各トリガーの Disposable を保持し、`deactivateTrigger` / `dispose` で適切にクリーンアップする
4. **排他制御**: 同一フローが実行中の場合はトリガーイベントをスキップする（ExecutionService.isRunning で判定）

コンストラクタ依存:

```typescript
constructor(
  executionService: IExecutionService,
  workspaceFolder: vscode.WorkspaceFolder,
)
```

#### デバウンス仕様

- fileChange トリガーが連続して発火した場合、最後のイベントから `debounceMs` 経過後に1回だけ実行する
- デフォルト値: 500ms

#### intervalSeconds バリデーション

- 最小値: 5秒。5秒未満が指定された場合は 5秒に補正する

### §3.6 コマンド・ステータスバー (FEAT-00001-003006)

以下のコマンドを追加する:

| コマンド ID | 表示名 | 動作 |
|---|---|---|
| `flowrunner.activateTrigger` | FlowRunner: トリガーを有効化 | 現在開いているフローのトリガーを有効化 |
| `flowrunner.deactivateTrigger` | FlowRunner: トリガーを無効化 | 現在開いているフローのトリガーを無効化 |
| `flowrunner.deactivateAllTriggers` | FlowRunner: 全トリガーを無効化 | 全アクティブトリガーを無効化 |

ステータスバー:

- アクティブなトリガーがある場合、ステータスバーに `$(zap) N triggers` を表示
- クリックで `flowrunner.deactivateAllTriggers` を実行

### §3.7 extensionMain.ts 統合 (FEAT-00001-003007)

```
activate() に以下を追加:
1. TriggerService を生成（Phase 2.5 相当）
2. コマンド登録（CommandRegistry に追加 or 直接登録）
3. ステータスバーアイテム生成
4. context.subscriptions に TriggerService, ステータスバーアイテムを追加
```

### §3.8 IExecutionContext 拡張 (FEAT-00001-003008)

```typescript
// 既存 IExecutionContext に triggerData を追加
export interface IExecutionContext {
  // ... 既存フィールド
  triggerData?: Record<string, unknown>;
}
```

ExecutionService.executeFlow に triggerData オプションを追加:

```typescript
executeFlow(flowId: string, options?: {
  depth?: number;
  triggerData?: Record<string, unknown>;
}): Promise<PortDataMap | undefined>;
```

## 影響範囲 (FEAT-00001-004000)

| コンポーネント | 変更内容 | 影響度 |
|---|---|---|
| TriggerExecutor | settingsSchema 追加、execute() に triggerData 対応 | 中 |
| IExecutionService | executeFlow に triggerData オプション追加 | 低（後方互換） |
| ExecutionService | triggerData をトリガーノードの context に渡す | 低 |
| IExecutionContext | triggerData フィールド追加 | 低（オプショナル） |
| extensionMain.ts | TriggerService 生成・コマンド追加 | 中 |
| CommandRegistry | トリガーコマンド追加 | 低 |
| package.json | コマンド定義追加 | 低 |

## テスト方針 (FEAT-00001-005000)

- **ユニットテスト**: TriggerExecutor の各 triggerType に対する出力データ検証、TriggerService のモック環境でのトリガー管理ロジック検証
- **結合テスト**: TriggerService → ExecutionService 連携の動作確認（モック vscode API 使用）
- **手動テスト**: 実環境でのファイル変更監視・スケジュール実行の動作確認

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00001-003001 | トリガー種別 | FEAT-00001-003001-00001 | manual トリガーで既存動作維持 | ✅ |
| FEAT-00001-003002 | 設定スキーマ | FEAT-00001-003002-00001 | settingsSchema に全フィールド定義あり | ✅ |
| FEAT-00001-003002 | 設定スキーマ | FEAT-00001-003002-00002 | visibleWhen が正しく設定されている | ✅ |
| FEAT-00001-003003 | 出力データ | FEAT-00001-003003-00001 | fileChange トリガーの出力データ形式 | ✅ |
| FEAT-00001-003003 | 出力データ | FEAT-00001-003003-00002 | schedule トリガーの出力データ形式 | ✅ |
| FEAT-00001-003003 | 出力データ | FEAT-00001-003003-00003 | triggerData 未設定時の manual フォールバック | ✅ |
| FEAT-00001-003004 | ITriggerService | FEAT-00001-003004-00001 | activateTrigger で fileChange トリガー登録 | ✅ |
| FEAT-00001-003004 | ITriggerService | FEAT-00001-003004-00002 | activateTrigger で schedule トリガー登録 | ✅ |
| FEAT-00001-003004 | ITriggerService | FEAT-00001-003004-00003 | deactivateTrigger でトリガー解除 | ✅ |
| FEAT-00001-003004 | ITriggerService | FEAT-00001-003004-00004 | deactivateAll で全トリガー解除 | ✅ |
| FEAT-00001-003004 | ITriggerService | FEAT-00001-003004-00005 | isActive の正確な判定 | ✅ |
| FEAT-00001-003005 | TriggerService | FEAT-00001-003005-00001 | fileChange デバウンス動作 | IT/手動確認 (※1) |
| FEAT-00001-003005 | TriggerService | FEAT-00001-003005-00002 | intervalSeconds 最小値補正 (< 5 → 5) | ✅ |
| FEAT-00001-003005 | TriggerService | FEAT-00001-003005-00003 | 同一フロー実行中はトリガーイベントスキップ | ✅ |
| FEAT-00001-003005 | TriggerService | FEAT-00001-003005-00004 | dispose で全リソースクリーンアップ | ✅ |
| FEAT-00001-003008 | IExecutionContext | FEAT-00001-003008-00001 | triggerData がトリガーノードに渡される | ✅ |

| FEAT-00001-003003 | 出力データ | FEAT-00001-003003-00010 | ファイル変更トリガーフロー手動実行 ST | ✅ |
| FEAT-00001-003003 | 出力データ | FEAT-00001-003003-00011 | スケジュールトリガーフロー手動実行 ST | ✅ |

> ※1: fileChange デバウンスは vscode.workspace.createFileSystemWatcher のイベント発火シミュレーションが必要なため、IT/手動テストでカバー
