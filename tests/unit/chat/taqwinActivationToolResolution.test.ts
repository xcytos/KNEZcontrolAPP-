import { describe, expect, test } from "vitest";
import { resolveTaqwinActivationToolName } from "../../../src/mcp/taqwin/TaqwinMcpService";

describe("resolveTaqwinActivationToolName", () => {
  test("prefers activate_taqwin_unified_consciousness when present", () => {
    const tool = resolveTaqwinActivationToolName([
      { name: "taqwin_activate" },
      { name: "activate_taqwin_unified_consciousness" },
    ]);
    expect(tool).toBe("activate_taqwin_unified_consciousness");
  });

  test("falls back to taqwin_activate when unified is absent", () => {
    const tool = resolveTaqwinActivationToolName([{ name: "taqwin_activate" }]);
    expect(tool).toBe("taqwin_activate");
  });

  test("returns null when neither tool exists", () => {
    const tool = resolveTaqwinActivationToolName([{ name: "get_server_status" }]);
    expect(tool).toBeNull();
  });
});
