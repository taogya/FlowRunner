// Trace: BD-03-003001, BD-03-003002
import type { INodeExecutor } from "./INodeExecutor.js";

/**
 * ノード種類ごとの INodeExecutor 実装を管理するレジストリ
 *
 * 新ノード追加時はここに登録するだけで拡張可能。
 */
// Trace: BD-03-003002
export interface INodeExecutorRegistry {
  /** ノード種別の Executor を登録する */
  register(nodeType: string, executor: INodeExecutor): void;

  /** ノード種別に対応する Executor を取得する */
  get(nodeType: string): INodeExecutor;

  /** 登録済みの全 Executor を返す */
  getAll(): INodeExecutor[];

  /** 指定ノード種別が登録済みかどうか */
  has(nodeType: string): boolean;
}
