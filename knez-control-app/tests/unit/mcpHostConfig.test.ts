import { describe, expect, test } from "vitest";
import { normalizeTaqwinMcpServer, parseMcpHostConfigJson, validateTaqwinMcpServer } from "../../src/mcp/config/McpHostConfig";
import { extractInputRefs, substituteInputRefs } from "../../src/mcp/config/McpInputs";

describe("McpHostConfig", () => {
  test("parses schema B mcpServers format (no working_directory)", () => {
    const raw = JSON.stringify({
      mcpServers: {
        taqwin: {
          command: "C:\\\\Python\\\\python.exe",
          args: ["-u", "C:\\\\TAQWIN_V1\\\\main.py"],
          env: { PYTHONUNBUFFERED: "1" }
        }
      }
    });
    const cfg = parseMcpHostConfigJson(raw);
    expect(cfg.servers.taqwin.command).toContain("python.exe");
    expect(cfg.servers.taqwin.cwd).toBe("C:\\\\TAQWIN_V1");
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

  test("prefers schema A servers when both schemas present", () => {
    const raw = JSON.stringify({
      schema_version: "1",
      servers: {
        taqwin: {
          command: "C:\\\\Python\\\\python.exe",
          args: ["-u", "C:\\\\TAQWIN_V1\\\\main.py"],
          working_directory: "C:\\\\TAQWIN_V1",
          env: { PYTHONUNBUFFERED: "1" },
          tags: ["a"]
        }
      },
      mcpServers: {
        taqwin: {
          command: "C:\\\\Other\\\\python.exe",
          args: ["-u", "C:\\\\Other\\\\main.py"],
          env: { PYTHONUNBUFFERED: "1" },
          tags: ["b"]
        }
      }
    });
    const cfg = parseMcpHostConfigJson(raw);
    expect(cfg.servers.taqwin.command).toBe("C:\\\\Python\\\\python.exe");
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

  test("parses http server config with inputs", () => {
    const raw = JSON.stringify({
      schema_version: "1",
      inputs: [{ type: "promptString", id: "github_mcp_pat", description: "GitHub PAT", password: true }],
      servers: {
        github: {
          type: "http",
          url: "https://api.githubcopilot.com/mcp/",
          headers: { Authorization: "Bearer ${input:github_mcp_pat}", "X-MCP-Readonly": "true" }
        }
      }
    });
    const cfg = parseMcpHostConfigJson(raw);
    expect(Array.isArray((cfg as any).inputs)).toBe(true);
    expect((cfg as any).inputs[0].id).toBe("github_mcp_pat");
    const gh: any = cfg.servers.github;
    expect(gh.type).toBe("http");
    expect(gh.url).toBe("https://api.githubcopilot.com/mcp/");
    expect(gh.headers.Authorization).toContain("${input:github_mcp_pat}");
  });

  test("extracts and substitutes ${input:...} references", () => {
    const v = { a: "Bearer ${input:token}", b: ["x", "${input:token}", "y"], c: { d: "${input:other}" } };
    const refs = extractInputRefs(v).sort();
    expect(refs).toEqual(["other", "token"]);
    const substituted = substituteInputRefs(v, { token: "T", other: "O" });
    expect((substituted as any).a).toBe("Bearer T");
    expect((substituted as any).b[1]).toBe("T");
    expect((substituted as any).c.d).toBe("O");
  });
});
