/**
 * FEAT-00002: VariableStore unit tests
 *
 * Tests for IVariableStore / VariableStore CRUD operations.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { VariableStore } from "@extension/interfaces/IVariableStore.js";

describe("VariableStore (FEAT-00002)", () => {
  let store: VariableStore;

  beforeEach(() => {
    store = new VariableStore();
  });

  // FEAT-00002-003001-00001: set/get で値を読み書きできる
  it("should set and get a value", () => {
    store.set("key1", "value1");
    expect(store.get("key1")).toBe("value1");
  });

  it("should overwrite existing value", () => {
    store.set("key1", "old");
    store.set("key1", "new");
    expect(store.get("key1")).toBe("new");
  });

  it("should handle various value types", () => {
    store.set("num", 42);
    store.set("obj", { a: 1 });
    store.set("arr", [1, 2, 3]);
    store.set("nil", null);
    expect(store.get("num")).toBe(42);
    expect(store.get("obj")).toEqual({ a: 1 });
    expect(store.get("arr")).toEqual([1, 2, 3]);
    expect(store.get("nil")).toBeNull();
  });

  // FEAT-00002-003001-00002: delete で変数を削除できる
  it("should delete an existing key and return true", () => {
    store.set("key1", "value1");
    expect(store.delete("key1")).toBe(true);
    expect(store.get("key1")).toBeUndefined();
  });

  it("should return false when deleting non-existent key", () => {
    expect(store.delete("nonexistent")).toBe(false);
  });

  // FEAT-00002-003001-00003: clear で全変数をクリアできる
  it("should clear all variables", () => {
    store.set("a", 1);
    store.set("b", 2);
    store.clear();
    expect(store.has("a")).toBe(false);
    expect(store.has("b")).toBe(false);
    expect(store.entries()).toEqual([]);
  });

  // FEAT-00002-003001-00004: has で存在判定できる
  it("should return true for existing key", () => {
    store.set("key1", "value1");
    expect(store.has("key1")).toBe(true);
  });

  it("should return false for non-existent key", () => {
    expect(store.has("nonexistent")).toBe(false);
  });

  // FEAT-00002-003001-00005: entries で全エントリを取得できる
  it("should return all entries", () => {
    store.set("x", 10);
    store.set("y", 20);
    const entries = store.entries();
    expect(entries).toEqual(expect.arrayContaining([["x", 10], ["y", 20]]));
    expect(entries).toHaveLength(2);
  });

  // FEAT-00002-003001-00006: 未定義キーの get は undefined を返す
  it("should return undefined for non-existent key", () => {
    expect(store.get("nope")).toBeUndefined();
  });
});
