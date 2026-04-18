import { describe, expect, it, vi } from "vitest";
import { extractImportedMcpConfig } from "../../../src/mcp/config/importMcpServers";

describe("extractImportedMcpConfig", () => {
  it("accepts full config with servers", () => {
    const res = extractImportedMcpConfig({ schema_version: "1", servers: { taqwin: { command: "python", args: [] } } });
    expect(res.servers.taqwin.command).toBe("python");
  });

  it("accepts full config with mcpServers", () => {
    const res = extractImportedMcpConfig({ mcpServers: { Puppeteer: { command: "npx", args: ["-y"] } } });
    expect(res.servers.Puppeteer.command).toBe("npx");
  });

  it("accepts server map", () => {
    const res = extractImportedMcpConfig({ a: { command: "node", args: [] }, b: { url: "http://x" } });
    expect(Object.keys(res.servers).sort()).toEqual(["a", "b"]);
  });

  it("accepts single server object with id", () => {
    const res = extractImportedMcpConfig({ id: "one", command: "node", args: [] });
    expect(Object.keys(res.servers)).toEqual(["one"]);
  });

  it("generates an id for single server object without id", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const res = extractImportedMcpConfig({ command: "node", args: [] });
    expect(Object.keys(res.servers)).toEqual(["server_123"]);
  });
});

