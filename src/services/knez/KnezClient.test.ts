import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./LogService", () => {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugThrottled: vi.fn(),
    },
  };
});

import { KnezClient } from '../knez/KnezClient';

describe("KnezClient", () => {
  beforeEach(() => {
    localStorage.clear();
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
  });

  it("emitTaqwinEvent sends a valid TaqwinResponse payload", async () => {
    localStorage.setItem(
      "knez_connection_profile",
      JSON.stringify({
        id: "t1",
        type: "local",
        transport: "http",
        endpoint: "http://127.0.0.1:8000",
        trustLevel: "untrusted",
      })
    );
    const client = new KnezClient();
    await client.emitTaqwinEvent("s1", "evt_name", { a: 1 });
    const calls = (globalThis as any).fetch.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [url, init] = calls[calls.length - 1];
    expect(String(url)).toContain("/taqwin/events");
    const body = JSON.parse(String(init.body));
    expect(body.session_id).toBe("s1");
    expect(body.intent).toBe("evt_name");
    expect(body.event).toBeUndefined();
    expect(body.payload).toBeUndefined();
    expect(Array.isArray(body.observations)).toBe(true);
    expect(body.observations[0].type).toBe("control_app_event");
  });

  it("pins fingerprint when setTrusted(true) succeeds", async () => {
    localStorage.setItem(
      "knez_connection_profile",
      JSON.stringify({
        id: "t2",
        type: "local",
        transport: "http",
        endpoint: "http://127.0.0.1:8000",
        trustLevel: "untrusted",
      })
    );
    (globalThis as any).fetch = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.endsWith("/identity")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ knez_instance_id: "iid1", fingerprint: "fp1", version: "0.1.0" }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    const client = new KnezClient();
    client.setTrusted(true);
    await new Promise((r) => setTimeout(r, 0));
    const p = client.getProfile();
    expect(p.trustLevel).toBe("verified");
    expect(p.pinnedFingerprint).toBe("fp1");
    expect(p.instanceId).toBe("iid1");
  });
});

