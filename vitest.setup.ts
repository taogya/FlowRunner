import "@testing-library/jest-dom/vitest";

// Mock acquireVsCodeApi for WebView tests
if (typeof (globalThis as any).acquireVsCodeApi !== "function") {
  (globalThis as any).acquireVsCodeApi = () => ({
    postMessage: () => {},
  });
}

// Polyfill addEventListener/removeEventListener for Node.js test environment
// Required by webview tests (MessageClient) that spy on globalThis.addEventListener
if (typeof globalThis.addEventListener !== "function") {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  (globalThis as any).addEventListener = (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(listener);
  };
  (globalThis as any).removeEventListener = (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => {
    listeners.get(type)?.delete(listener);
  };
}
