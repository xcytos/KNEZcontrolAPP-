import { McpHostConfig } from "./McpHostConfig";

export function getDefaultMcpHostConfig(): { raw: string; config: McpHostConfig } {
  const rawObj = {
    schema_version: "1",
    inputs: [
      {
        type: "promptString",
        id: "github_mcp_pat",
        description: "GitHub Personal Access Token",
        password: true
      }
    ],
    servers: {
      taqwin: {
        command: "python",
        args: ["-u", "main.py", "mcp"],
        working_directory: "..\\\\TAQWIN_V1",
        env: { PYTHONUNBUFFERED: "1" },
        enabled: true,
        tags: ["taqwin", "mcp"]
      },
      chrome_devtools: {
        command: "npx",
        args: ["-y", "chrome-devtools-mcp@latest", "--no-usage-statistics"],
        env: {},
        enabled: false,
        tags: ["chrome", "devtools", "mcp", "npx"]
      },
      github_remote: {
        type: "http",
        url: "https://api.githubcopilot.com/mcp/",
        headers: {
          Authorization: "Bearer ${input:github_mcp_pat}",
          "X-MCP-Toolsets": "repos,issues,pull_requests",
          "X-MCP-Readonly": "true"
        },
        enabled: false,
        tags: ["github", "mcp", "remote"]
      },
      github_local: {
        command: "docker",
        args: ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "-e", "GITHUB_READ_ONLY", "ghcr.io/github/github-mcp-server"],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${input:github_mcp_pat}", GITHUB_READ_ONLY: "1" },
        enabled: false,
        tags: ["github", "mcp", "local", "docker"]
      }
    }
  };
  const raw = JSON.stringify(rawObj, null, 2);
  const config: McpHostConfig = {
    schema_version: "1",
    inputs: rawObj.inputs as any,
    servers: {
      taqwin: {
        id: "taqwin",
        type: "stdio",
        command: String(rawObj.servers.taqwin.command),
        args: rawObj.servers.taqwin.args.slice(),
        cwd: String(rawObj.servers.taqwin.working_directory),
        env: { ...rawObj.servers.taqwin.env },
        enabled: true,
        tags: rawObj.servers.taqwin.tags.slice()
      },
      chrome_devtools: {
        id: "chrome_devtools",
        type: "stdio",
        command: String((rawObj.servers as any).chrome_devtools.command),
        args: (rawObj.servers as any).chrome_devtools.args.slice(),
        cwd: undefined,
        env: { ...(rawObj.servers as any).chrome_devtools.env },
        enabled: false,
        tags: (rawObj.servers as any).chrome_devtools.tags.slice()
      },
      github_remote: {
        id: "github_remote",
        type: "http",
        url: String((rawObj.servers as any).github_remote.url),
        headers: { ...(rawObj.servers as any).github_remote.headers },
        enabled: false,
        tags: (rawObj.servers as any).github_remote.tags.slice()
      },
      github_local: {
        id: "github_local",
        type: "stdio",
        command: String((rawObj.servers as any).github_local.command),
        args: (rawObj.servers as any).github_local.args.slice(),
        cwd: undefined,
        env: { ...(rawObj.servers as any).github_local.env },
        enabled: false,
        tags: (rawObj.servers as any).github_local.tags.slice()
      }
    }
  };
  return { raw, config };
}
