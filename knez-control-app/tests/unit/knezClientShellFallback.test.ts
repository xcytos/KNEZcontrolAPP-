import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@tauri-apps/plugin-shell", () => {
  return {
    Command: {
      create: () => ({
        execute: vi.fn(async () => ({
          code: 0,
          signal: null,
          stdout: JSON.stringify({
            id: "x",
            object: "chat.completion",
            model: "local",
            choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          }),
          stderr: "",
        })),
      }),
    },
  };
});

describe("KnezClient non-stream shell fallback", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    (window as any).__TAURI__ = {};
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as any;
    localStorage.removeItem("knez_connection_profile");
    localStorage.removeItem("knez_session_id");
  });

  afterEach(() => {
    globalThis.fetch = origFetch as any;
  });

  it("returns a completion via shell when fetch fails in Tauri", async () => {
    const { KnezClient } = await import("../../src/services/KnezClient");
    const client = new KnezClient();
    const out = await client.chatCompletionsNonStream(
      [{ role: "user", content: "hi" }],
      "sid1"
    );
    expect(out).toBe("ok");
  });
});

