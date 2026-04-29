// DD-03 HttpExecutor UT tests
// Trace: DD-03-008002

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpExecutor } from "@extension/executors/HttpExecutor.js";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";

function makeContext(overrides?: Partial<IExecutionContext>): IExecutionContext {
  const defaults: IExecutionContext = {
    nodeId: "n1",
    flowId: "f1",
    settings: { url: "https://example.com/data", method: "GET" },
    inputs: { in: "test" },
    signal: new AbortController().signal,
    variables: { set() {}, get() { return undefined; }, delete() { return false; }, clear() {}, has() { return false; }, entries() { return []; } },
  };
  return { ...defaults, ...overrides };
}

function mockFetch(body: string, status = 200) {
  return vi.fn().mockResolvedValue({
    text: vi.fn().mockResolvedValue(body),
    status,
  });
}

describe("HttpExecutor", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // --- validate ---

  // DDUT-03-008002-00001
  it("validate_emptyUrl_returnsInvalid", () => {
    const executor = new HttpExecutor();
    const result = executor.validate({ url: "" });
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]?.field).toBe("url");
  });

  // DDUT-03-008002-00002
  it("validate_withUrl_returnsValid", () => {
    const executor = new HttpExecutor();
    const result = executor.validate({ url: "https://example.com" });
    expect(result.valid).toBe(true);
  });

  // --- execute ---

  // DDUT-03-008002-00003
  it("execute_getRequest_returnsBodyAndStatus", async () => {
    const executor = new HttpExecutor();
    const fetchMock = mockFetch('{"ok":true}', 200);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = makeContext();

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.body).toBe('{"ok":true}');
    expect(result.outputs.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  // DDUT-03-008002-00004
  it("execute_postRequest_sendsBody", async () => {
    const executor = new HttpExecutor();
    const fetchMock = mockFetch("created", 201);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = makeContext({
      settings: {
        url: "https://example.com",
        method: "POST",
        body: '{"name":"{{input}}"}',
      },
      inputs: { in: "test" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(result.outputs.status).toBe(201);
    // Verify body was passed to fetch
    const fetchCall = fetchMock.mock.calls[0];
    expect(fetchCall[1].method).toBe("POST");
    expect(fetchCall[1].body).toBe('{"name":"test"}');
  });

  // DDUT-03-008002-00005
  it("execute_bearerAuth_addsAuthorizationHeader", async () => {
    const executor = new HttpExecutor();
    const fetchMock = mockFetch("ok", 200);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = makeContext({
      settings: {
        url: "https://example.com",
        method: "GET",
        auth: "bearer",
        authToken: "example-bearer-token",
      },
    });

    await executor.execute(ctx);

    const fetchCall = fetchMock.mock.calls[0];
    expect(fetchCall[1].headers["Authorization"]).toBe("Bearer example-bearer-token");
  });

  // DDUT-03-008002-00006
  it("execute_customHeaders_sentInRequest", async () => {
    const executor = new HttpExecutor();
    const fetchMock = mockFetch("ok", 200);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = makeContext({
      settings: {
        url: "https://example.com",
        method: "GET",
        headers: { "X-Custom": "value" },
      },
    });

    await executor.execute(ctx);

    const fetchCall = fetchMock.mock.calls[0];
    expect(fetchCall[1].headers["X-Custom"]).toBe("value");
  });

  // DDUT-03-008002-00007
  it("execute_fetchThrows_returnsError", async () => {
    const executor = new HttpExecutor();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error")) as unknown as typeof fetch;
    const ctx = makeContext();

    const result = await executor.execute(ctx);

    expect(result.status).toBe("error");
    expect(result.error?.message).toBe("network error");
  });

  // DDUT-03-008002-00008
  it("execute_abortedSignal_returnsCancelled", async () => {
    const executor = new HttpExecutor();
    const ac = new AbortController();
    ac.abort();
    const ctx = makeContext({ signal: ac.signal });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("cancelled");
  });

  // DDUT-03-008002-00009
  it("execute_templateInUrl_expanded", async () => {
    const executor = new HttpExecutor();
    const fetchMock = mockFetch("ok", 200);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = makeContext({
      settings: { url: "https://example.com/{{input}}", method: "GET" },
      inputs: { in: "42" },
    });

    await executor.execute(ctx);

    const fetchCall = fetchMock.mock.calls[0];
    expect(fetchCall[0]).toBe("https://example.com/42");
  });

  // DDUT-03-008002-00010
  it("execute_privateNetworkUrl_warnsButProceeds", async () => {
    const appendLine = vi.fn();
    const executor = new HttpExecutor({ appendLine });
    const fetchMock = mockFetch("ok", 200);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = makeContext({
      settings: { url: "http://192.168.1.1/api", method: "GET" },
    });

    const result = await executor.execute(ctx);

    expect(result.status).toBe("success");
    expect(appendLine).toHaveBeenCalledWith(expect.stringContaining("private network"));
  });

  // DDUT-03-008002-00011
  it("execute_getWithBody_doesNotSendBody", async () => {
    const executor = new HttpExecutor();
    const fetchMock = mockFetch("ok", 200);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = makeContext({
      settings: { url: "https://example.com", method: "GET", body: "ignored" },
    });

    await executor.execute(ctx);

    const fetchCall = fetchMock.mock.calls[0];
    expect(fetchCall[1].body).toBeUndefined();
  });
});
