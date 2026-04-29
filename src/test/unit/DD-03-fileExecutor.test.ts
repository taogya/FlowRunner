// DD-03 FileExecutor execute UT tests
// Trace: DD-03-008001

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileExecutor } from "@extension/executors/FileExecutor.js";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";

// Mock fs.promises
vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    appendFile: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(),
  },
}));

// Mock vscode (already in __mocks__/vscode.ts, but ensure workspaceFolders)
vi.mock("vscode", () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "/workspace" } }],
  },
}));

import * as fs from "fs";

const emptyVars = {
  set() {},
  get() { return undefined; },
  delete() { return false; },
  clear() {},
  has() { return false; },
  entries(): [string, unknown][] { return []; },
};

function makeContext(overrides?: Partial<IExecutionContext>): IExecutionContext {
  return {
    nodeId: "n1",
    flowId: "f1",
    settings: { operation: "read", path: "/tmp/test.txt" },
    inputs: { in: "" },
    signal: new AbortController().signal,
    variables: emptyVars,
    ...overrides,
  };
}

describe("FileExecutor execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // DDUT-03-008001-00005
  it("execute_readFile_returnsContent", async () => {
    vi.mocked(fs.promises.readFile).mockResolvedValue("file content");
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "read", path: "/tmp/test.txt", encoding: "utf-8" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe("file content");
    expect(fs.promises.readFile).toHaveBeenCalledWith("/tmp/test.txt", "utf-8");
  });

  // DDUT-03-008001-00006
  it("execute_writeFile_writesInput", async () => {
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "write", path: "/tmp/out.txt" },
      inputs: { in: "hello world" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.out).toEqual({ success: true });
    expect(fs.promises.writeFile).toHaveBeenCalledWith("/tmp/out.txt", "hello world", "utf-8");
  });

  // DDUT-03-008001-00007
  it("execute_appendFile_appendsInput", async () => {
    vi.mocked(fs.promises.appendFile).mockResolvedValue(undefined);
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "append", path: "/tmp/log.txt" },
      inputs: { in: "new line" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(fs.promises.appendFile).toHaveBeenCalledWith("/tmp/log.txt", "new line", "utf-8");
  });

  // DDUT-03-008001-00008
  it("execute_deleteFile_unlinks", async () => {
    vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "delete", path: "/tmp/old.txt" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.out).toEqual({ success: true });
    expect(fs.promises.unlink).toHaveBeenCalledWith("/tmp/old.txt");
  });

  // DDUT-03-008001-00009
  it("execute_existsFile_returnsTrueWhenExists", async () => {
    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "exists", path: "/tmp/test.txt" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe(true);
  });

  // DDUT-03-008001-00010
  it("execute_existsFile_returnsFalseWhenNotExists", async () => {
    vi.mocked(fs.promises.access).mockRejectedValue(new Error("ENOENT"));
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "exists", path: "/tmp/nope.txt" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.out).toBe(false);
  });

  // DDUT-03-008001-00011
  it("execute_listDir_returnsEntries", async () => {
    vi.mocked(fs.promises.readdir).mockResolvedValue(["a.txt", "b.txt"] as unknown as Awaited<ReturnType<typeof fs.promises.readdir>>);
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "listDir", path: "/tmp/dir" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.out).toEqual(["a.txt", "b.txt"]);
  });

  // DDUT-03-008001-00012
  it("execute_unknownOperation_returnsError", async () => {
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "unknown", path: "/tmp/test.txt" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("Unknown operation");
  });

  // DDUT-03-008001-00013
  it("execute_readThrows_returnsError", async () => {
    vi.mocked(fs.promises.readFile).mockRejectedValue(new Error("ENOENT"));
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "read", path: "/tmp/missing.txt" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("error");
    expect(result.error?.message).toBe("ENOENT");
  });

  // DDUT-03-008001-00014
  it("execute_abortedSignal_returnsCancelled", async () => {
    const executor = new FileExecutor();
    const ac = new AbortController();
    ac.abort();
    const ctx = makeContext({ signal: ac.signal });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("cancelled");
  });

  // DDUT-03-008001-00015
  it("execute_relativePath_resolvesAgainstWorkspace", async () => {
    vi.mocked(fs.promises.readFile).mockResolvedValue("data");
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "read", path: "data/file.txt" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(fs.promises.readFile).toHaveBeenCalledWith("/workspace/data/file.txt", "utf-8");
  });

  // DDUT-03-008001-00016
  it("execute_templateInPath_expanded", async () => {
    vi.mocked(fs.promises.readFile).mockResolvedValue("ok");
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "read", path: "/tmp/{{input}}.txt" },
      inputs: { in: "report" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(fs.promises.readFile).toHaveBeenCalledWith("/tmp/report.txt", "utf-8");
  });

  // DDUT-03-008001-00017
  it("execute_pathTraversalAfterExpansion_returnsError", async () => {
    const executor = new FileExecutor();
    const ctx = makeContext({
      settings: { operation: "read", path: "{{input}}" },
      inputs: { in: "../../etc/passwd" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("path traversal");
  });
});
