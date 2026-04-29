// DD-02 MessageClient UT tests
// Trace: DD-02-009001, DD-02-009002

import { describe, it, expect, vi } from "vitest";
import { MessageClient } from "@webview/services/MessageClient.js";

describe("MessageClient", () => {
  // --- DD-02-009001: 概要 ---

  // DDUT-02-009001-00001
  it("canBeInstantiated", () => {
    // Arrange
    const mockVscodeApi = { postMessage: vi.fn() };

    // Act
    const client = new MessageClient(mockVscodeApi as any);

    // Assert
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(MessageClient);
  });

  // DDUT-02-009002-00001
  it("send_callsPostMessage", () => {
    // Arrange
    const mockVscodeApi = {
      postMessage: vi.fn(),
    };
    const client = new MessageClient(mockVscodeApi as any);

    // Act
    client.send("flow:load", { flowId: "f1" });

    // Assert
    expect(mockVscodeApi.postMessage).toHaveBeenCalledWith({
      type: "flow:load",
      payload: { flowId: "f1" },
    });
  });

  // DDUT-02-009002-00002
  it("onMessage_registersListener", () => {
    // Arrange
    const mockVscodeApi = { postMessage: vi.fn() };
    const client = new MessageClient(mockVscodeApi as any);
    const handler = vi.fn();
    const addEventSpy = vi.spyOn(globalThis, "addEventListener" as any);

    // Act
    const disposable = client.onMessage(handler);

    // Assert
    expect(addEventSpy).toHaveBeenCalledWith("message", expect.any(Function));
    disposable.dispose();
    addEventSpy.mockRestore();
  });

  // DDUT-02-009002-00003
  it("onMessage_dispose_removesListener", () => {
    // Arrange
    const mockVscodeApi = { postMessage: vi.fn() };
    const client = new MessageClient(mockVscodeApi as any);
    const handler = vi.fn();
    const removeSpy = vi.spyOn(globalThis, "removeEventListener" as any);

    // Act
    const disposable = client.onMessage(handler);
    disposable.dispose();

    // Assert
    expect(removeSpy).toHaveBeenCalledWith("message", expect.any(Function));
    removeSpy.mockRestore();
  });
});
