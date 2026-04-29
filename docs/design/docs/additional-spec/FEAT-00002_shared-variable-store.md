# FEAT-00002: 共有変数ストア

- 対応する RD 参照: RD-01 §10 #2（全ノードがアクセス可能な変数空間）

## 概要

フロー実行中に全ノードがアクセス可能な共有変数ストアを提供する。既存のエッジベースデータフロー（outputMap）はそのまま維持し、ノード間でスコープを超えたデータ共有を可能にする。

## スコープ (FEAT-00002-002000)

### 実装する範囲

- IVariableStore インターフェース定義
- IExecutionContext への `variables` フィールド追加
- ExecutionService でのストア生成・注入
- DebugService でのストア生成・注入
- TransformExecutor での変数読み書きサポート（`setVar` / `getVar` 操作）

### スコープ外

- WebView UI での変数一覧表示
- 変数の永続化（フロー実行終了で消滅）
- 変数型バリデーション（型は unknown）
- jexl 式内からの直接変数参照（将来拡張）

## 仕様

### §3.1 IVariableStore インターフェース (FEAT-00002-003001)

```typescript
// src/extension/interfaces/IVariableStore.ts
export interface IVariableStore {
  /** 変数を設定する */
  set(key: string, value: unknown): void;

  /** 変数を取得する（未定義なら undefined） */
  get(key: string): unknown;

  /** 変数を削除する */
  delete(key: string): boolean;

  /** 全変数をクリアする */
  clear(): void;

  /** 変数が存在するか */
  has(key: string): boolean;

  /** 全変数のエントリを返す */
  entries(): [string, unknown][];
}
```

実装は `Map<string, unknown>` ベースのシンプルなインメモリストア。

### §3.2 IExecutionContext 拡張 (FEAT-00002-003002)

```typescript
export interface IExecutionContext {
  // ... 既存フィールド
  variables?: IVariableStore;
}
```

`variables` はオプショナル。未設定の場合、エグゼキュータは変数機能を使用できない（後方互換維持）。

### §3.3 ExecutionService 統合 (FEAT-00002-003003)

- `executeFlow()` 開始時に `VariableStore` インスタンスを生成
- 全ノード（ループ本体含む）の `IExecutionContext.variables` に同一インスタンスを渡す
- フロー実行完了時にストアは GC で回収（明示的クリア不要）

### §3.4 DebugService 統合 (FEAT-00002-003004)

- `start()` 時に `VariableStore` インスタンスを生成
- 各ステップの `IExecutionContext.variables` に同一インスタンスを渡す
- デバッグセッション終了時に破棄

### §3.5 TransformExecutor 変数操作 (FEAT-00002-003005)

TransformExecutor の `transformType` に以下を追加:

| transformType | 動作 | settings |
|---|---|---|
| `setVar` | 変数に値を設定し、入力をそのまま出力に流す | `varName: string` |
| `getVar` | 変数の値を出力する | `varName: string`, `defaultValue?: unknown` |

`setVar` の動作:
- `context.variables.set(settings.varName, context.inputs.in)`
- 出力: `{ out: context.inputs.in }`（パススルー）

`getVar` の動作:
- `const value = context.variables.get(settings.varName) ?? settings.defaultValue`
- 出力: `{ out: value }`

## 影響範囲 (FEAT-00002-004000)

| コンポーネント | 変更内容 | 影響度 |
|---|---|---|
| IExecutionContext | `variables` フィールド追加 | 低（オプショナル） |
| ExecutionService | VariableStore 生成・注入 | 低 |
| DebugService | VariableStore 生成・注入 | 低 |
| TransformExecutor | setVar/getVar 操作追加 | 中 |

## テスト方針 (FEAT-00002-005000)

- **ユニットテスト**: VariableStore の CRUD 操作、TransformExecutor の setVar/getVar
- **結合テスト**: ExecutionService 経由でのフロー実行時に変数が全ノードで共有されることの検証

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00002-003001 | IVariableStore | FEAT-00002-003001-00001 | set/get で値を読み書きできる | ✅ |
| FEAT-00002-003001 | IVariableStore | FEAT-00002-003001-00002 | delete で変数を削除できる | ✅ |
| FEAT-00002-003001 | IVariableStore | FEAT-00002-003001-00003 | clear で全変数をクリアできる | ✅ |
| FEAT-00002-003001 | IVariableStore | FEAT-00002-003001-00004 | has で存在判定できる | ✅ |
| FEAT-00002-003001 | IVariableStore | FEAT-00002-003001-00005 | entries で全エントリを取得できる | ✅ |
| FEAT-00002-003001 | IVariableStore | FEAT-00002-003001-00006 | 未定義キーの get は undefined を返す | ✅ |
| FEAT-00002-003002 | IExecutionContext | FEAT-00002-003002-00001 | variables 未設定でも既存動作に影響しない | ✅ |
| FEAT-00002-003003 | ExecutionService | FEAT-00002-003003-00001 | フロー実行中に全ノードが同一ストアを共有する | ✅ |
| FEAT-00002-003004 | DebugService | FEAT-00002-003004-00001 | デバッグ実行で変数ストアが利用可能 | ✅ |
| FEAT-00002-003005 | TransformExecutor | FEAT-00002-003005-00001 | setVar で変数を設定しパススルーする | ✅ |
| FEAT-00002-003005 | TransformExecutor | FEAT-00002-003005-00002 | getVar で変数を取得する | ✅ |
| FEAT-00002-003005 | TransformExecutor | FEAT-00002-003005-00003 | getVar で未定義変数に defaultValue を返す | ✅ |
| FEAT-00002-003005 | TransformExecutor | FEAT-00002-003005-00004 | variables 未設定時に setVar/getVar がエラーにならない | ✅ |
| FEAT-00002-003001 | IVariableStore | FEAT-00002-003001-00010 | setVar → getVar 共有変数フロー ST | ✅ |
| FEAT-00002-003001 | IVariableStore | FEAT-00002-003001-00011 | getVar 未設定変数デフォルト値 ST | ✅ |
