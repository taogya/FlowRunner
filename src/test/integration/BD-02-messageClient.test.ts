// @vitest-environment jsdom
// BD-02 MessageClient IT tests
// Trace: BD-02-004007 MessageClient

import { describe, it, expect, vi } from "vitest";
import { MessageClient } from "@webview/services/MessageClient.js";

function createMessageClient() {
  const vsCodeApi = { postMessage: vi.fn() };
  return { client: new MessageClient(vsCodeApi), vsCodeApi };
}

describe("IMessageClient (BD-02-004007)", () => {
  // BDIT-02-004007-00001
  it("send_withTypeAndPayload_recordsMessage", () => {
    const { client, vsCodeApi } = createMessageClient();

    client.send("flow:save", { flowId: "flow-1" });

    expect(vsCodeApi.postMessage).toHaveBeenCalledWith({
      type: "flow:save",
      payload: { flowId: "flow-1" },
    });
  });

  // BDIT-02-004007-00002
  it("onMessage_withHandler_receivesSimulatedMessage", () => {
    const { client } = createMessageClient();
    const received: Array<{ type: string; payload: Record<string, unknown> }> =
      [];

    client.onMessage((msg) => {
      received.push(msg);
    });

    globalThis.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "flow:loaded", payload: { flowId: "flow-1" } },
      }),
    );

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("flow:loaded");
    expect(received[0].payload).toEqual({ flowId: "flow-1" });
  });

  // BDIT-02-004007-00003
  it("onMessage_afterDispose_noLongerReceivesMessages", () => {
    const { client } = createMessageClient();
    const received: Array<{ type: string; payload: Record<string, unknown> }> =
      [];

    const disposable = client.onMessage((msg) => {
      received.push(msg);
    });

    globalThis.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "flow:loaded", payload: { flowId: "flow-1" } },
      }),
    );
    expect(received).toHaveLength(1);

    disposable.dispose();

    globalThis.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "flow:loaded", payload: { flowId: "flow-2" } },
      }),
    );
    expect(received).toHaveLength(1); // No new message after dispose
  });
});
