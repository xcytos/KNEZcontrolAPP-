import { describe, expect, it } from "vitest";
import { normalizeMcpConfig } from "../../../src/mcp/config/McpHostConfig";
import { inferStdioPreferredFraming } from "../../../src/mcp/client/stdioHeuristics";
import { getDefaultMcpHostConfig } from "../../../src/mcp/config/DefaultMcpHostConfig";

describe("MCP validation matrix", () => {
  it("normalizes TAQWIN python stdio server", () => {
    const cfg = normalizeMcpConfig({
      schema_version: "1",
      servers: {
        taqwin: {
          command: "python",
          args: ["-u", "C:/TAQWIN_V1/main.py"],
          env: { PYTHONUNBUFFERED: "1" }
        }
      }
    } as any);
    expect(cfg.servers.taqwin.type).toBe("stdio");
    expect(cfg.servers.taqwin.command).toBe("python");
    expect(inferStdioPreferredFraming({ command: cfg.servers.taqwin.command, args: cfg.servers.taqwin.args, env: cfg.servers.taqwin.env })).toBe(
      "content-length"
    );
  });

  it("normalizes npx stdio servers and prefers line framing", () => {
    const cfg = normalizeMcpConfig({
      schema_version: "1",
      servers: {
        puppeteer: { command: "npx", args: ["-y", "@modelcontextprotocol/server-puppeteer"] },
        chrome: { command: "npx", args: ["-y", "chrome-devtools-mcp@latest"] }
      }
    } as any);
    expect(cfg.servers.puppeteer.type).toBe("stdio");
    expect(cfg.servers.chrome.type).toBe("stdio");
    expect(inferStdioPreferredFraming({ command: cfg.servers.puppeteer.command, args: cfg.servers.puppeteer.args, env: cfg.servers.puppeteer.env })).toBe(
      "line"
    );
    expect(inferStdioPreferredFraming({ command: cfg.servers.chrome.command, args: cfg.servers.chrome.args, env: cfg.servers.chrome.env })).toBe("line");
  });

  it("normalizes HTTP servers when url is present", () => {
    const cfg = normalizeMcpConfig({
      schema_version: "1",
      servers: {
        sse: { url: "http://127.0.0.1:7777/mcp", headers: { Authorization: "Bearer x" } }
      }
    } as any);
    expect(cfg.servers.sse.type).toBe("http");
    expect((cfg.servers.sse as any).url).toContain("http");
  });

  it("includes chrome_devtools preset in default config", () => {
    const def = getDefaultMcpHostConfig();
    expect(def.config.servers.chrome_devtools).toBeDefined();
    expect(def.config.servers.chrome_devtools.command.toLowerCase()).toBe("npx");
    expect(def.config.servers.chrome_devtools.args.join(" ")).toContain("chrome-devtools-mcp@latest");
  });
});

