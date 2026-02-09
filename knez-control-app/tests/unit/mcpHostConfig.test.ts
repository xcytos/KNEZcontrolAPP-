import { describe, expect, test } from "vitest";
import { normalizeTaqwinMcpServer, parseMcpHostConfigJson, validateTaqwinMcpServer } from "../../src/mcp/config/McpHostConfig";

describe("McpHostConfig", () => {
  test("parses mcpServers format", () => {
    const raw = JSON.stringify({
      mcpServers: {
        taqwin: {
          command: "C:\\\\Python\\\\python.exe",
          args: ["-u", "C:\\\\TAQWIN_V1\\\\main.py"],
          cwd: "C:\\\\TAQWIN_V1",
          env: { PYTHONUNBUFFERED: "1" }
        }
      }
    });
    const cfg = parseMcpHostConfigJson(raw);
    expect(cfg.servers.taqwin.command).toContain("python.exe");
  });

  test("parses legacy servers format", () => {
    const raw = JSON.stringify({
      schema_version: "1",
      servers: {
        taqwin: {
          command: "C:\\\\Python\\\\python.exe",
          args: ["-u", "C:\\\\TAQWIN_V1\\\\main.py"],
          working_directory: "C:\\\\TAQWIN_V1",
          env: { PYTHONUNBUFFERED: "1" }
        }
      }
    });
    const cfg = parseMcpHostConfigJson(raw);
    expect(cfg.servers.taqwin.cwd).toBe("C:\\\\TAQWIN_V1");
  });

  test("validates required fields per TAQWIN guide", () => {
    const cfg = parseMcpHostConfigJson(
      JSON.stringify({
        mcpServers: {
          taqwin: {
            command: "python",
            args: ["main.py"],
            cwd: "TAQWIN_V1",
            env: {}
          }
        }
      })
    );
    const issues = validateTaqwinMcpServer(cfg.servers.taqwin);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  test("normalizes env and -u", () => {
    const cfg = parseMcpHostConfigJson(
      JSON.stringify({
        mcpServers: {
          taqwin: {
            command: "C:\\\\Python\\\\python.exe",
            args: ["C:\\\\TAQWIN_V1\\\\main.py"],
            cwd: "C:\\\\TAQWIN_V1",
            env: {}
          }
        }
      })
    );
    const normalized = normalizeTaqwinMcpServer(cfg.servers.taqwin);
    expect(normalized.args[0]).toBe("-u");
    expect(normalized.env.PYTHONUNBUFFERED).toBe("1");
  });
});
