import { describe, expect, it } from "vitest";
import { inferInitializeTimeoutMs, inferStdioPreferredFraming } from "../../src/mcp/client/stdioHeuristics";

describe("stdio heuristics", () => {
  it("prefers line framing for npx servers", () => {
    expect(inferStdioPreferredFraming({ command: "npx", args: ["-y", "@modelcontextprotocol/server-puppeteer"] })).toBe("line");
    expect(inferStdioPreferredFraming({ command: "C:\\\\tools\\\\npx.cmd", args: ["-y", "x"] })).toBe("line");
  });

  it("respects explicit KNEZ_MCP_CLIENT_FRAMING", () => {
    expect(inferStdioPreferredFraming({ command: "python", env: { KNEZ_MCP_CLIENT_FRAMING: "content-length" } })).toBe("content-length");
    expect(inferStdioPreferredFraming({ command: "python", env: { KNEZ_MCP_CLIENT_FRAMING: "line" } })).toBe("line");
  });

  it("uses longer initialize timeout for npx servers", () => {
    expect(inferInitializeTimeoutMs({ command: "npx", args: [] })).toBeGreaterThanOrEqual(60000);
    expect(inferInitializeTimeoutMs({ command: "python", args: ["-u", "main.py"] })).toBe(15000);
  });
});

