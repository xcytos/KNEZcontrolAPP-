import { describe, expect, it, vi } from "vitest";

describe("ExtractionService governance", () => {
  it("blocks proxy fallback when external fetch is not explicitly allowed", async () => {
    vi.resetModules();
    (globalThis as any).window = (globalThis as any).window ?? ({} as any);
    (globalThis as any).window.setTimeout = (globalThis as any).window.setTimeout ?? setTimeout;
    (globalThis as any).window.clearTimeout = (globalThis as any).window.clearTimeout ?? clearTimeout;
    (globalThis as any).fetch = vi.fn(async () => {
      throw new Error("fetch_should_not_run");
    });

    vi.doMock("../../../src/services/GovernanceService", () => ({
      governanceService: { isExternalFetchAllowed: async () => false }
    }));
    vi.doMock("../../../src/services/KnezClient", () => ({ knezClient: { addKnowledge: async () => {} } }));

    const { extractionService } = await import("../../../src/services/ExtractionService");
    const res = await extractionService.extract("https://example.com", "raw", 50);

    expect(res.summary).toBe("Extraction Blocked (Governance)");
    expect(res.error).toBe("mcp_permission_denied:external_fetch_blocked_by_governance");
    expect((res.data as any)?.error?.code).toBe("mcp_permission_denied");
  });
});

