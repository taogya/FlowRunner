// Trace: FEAT-00002-003001

/**
 * 共有変数ストア — フロー実行中に全ノードがアクセス可能な変数空間
 */
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

/**
 * Map ベースのインメモリ実装
 */
// Trace: FEAT-00002-003001
export class VariableStore implements IVariableStore {
  private readonly store = new Map<string, unknown>();

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  get(key: string): unknown {
    return this.store.get(key);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  entries(): [string, unknown][] {
    return Array.from(this.store.entries());
  }
}
