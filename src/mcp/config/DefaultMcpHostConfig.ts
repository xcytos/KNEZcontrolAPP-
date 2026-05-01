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
    mcpServers: {
      chrome_devtools: {
        command: "npx",
        args: ["-y", "chrome-devtools-mcp@latest", "--no-usage-statistics"],
        env: {},
        enabled: true,
        start_on_boot: true,
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
        enabled: true,
        start_on_boot: true,
        tags: ["github", "mcp", "remote"]
      },
      github_local: {
        command: "docker",
        args: ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "-e", "GITHUB_READ_ONLY", "ghcr.io/github/github-mcp-server"],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${input:github_mcp_pat}", GITHUB_READ_ONLY: "1" },
        enabled: false,
        tags: ["github", "mcp", "local", "docker"]
      },
      "io.windsurf/puppeteer": {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-puppeteer"],
        env: {},
        enabled: true,
        start_on_boot: true,
        tags: ["puppeteer", "browser", "mcp", "npx"]
      },
      playwright: {
        command: "npx",
        args: ["@playwright/mcp"],
        env: {},
        enabled: true,
        start_on_boot: true,
        tags: ["playwright", "browser", "mcp", "npx"]
      }
    }
  };
  const raw = JSON.stringify(rawObj, null, 2);
  const config: McpHostConfig = {
    schema_version: "1",
    inputs: rawObj.inputs as any,
    servers: {
      chrome_devtools: {
        id: "chrome_devtools",
        type: "stdio",
        command: String((rawObj.mcpServers as any).chrome_devtools.command),
        args: (rawObj.mcpServers as any).chrome_devtools.args.slice(),
        cwd: undefined,
        env: {},
        enabled: true,
        start_on_boot: true,
        tags: (rawObj.mcpServers as any).chrome_devtools.tags.slice()
      },
      github_remote: {
        id: "github_remote",
        type: "http",
        url: String((rawObj.mcpServers as any).github_remote.url),
        headers: { ...(rawObj.mcpServers as any).github_remote.headers },
        enabled: false,
        tags: (rawObj.mcpServers as any).github_remote.tags.slice()
      },
      github_local: {
        id: "github_local",
        type: "stdio",
        command: String((rawObj.mcpServers as any).github_local.command),
        args: (rawObj.mcpServers as any).github_local.args.slice(),
        cwd: undefined,
        env: { ...(rawObj.mcpServers as any).github_local.env },
        enabled: false,
        tags: (rawObj.mcpServers as any).github_local.tags.slice()
      },
      "io.windsurf/puppeteer": {
        id: "io.windsurf/puppeteer",
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-puppeteer"],
        cwd: undefined,
        env: {},
        enabled: true,
        start_on_boot: true,
        tags: ["puppeteer", "browser", "mcp", "npx"]
      },
      playwright: {
        id: "playwright",
        type: "stdio",
        command: "npx",
        args: ["@playwright/mcp"],
        cwd: undefined,
        env: {},
        enabled: true,
        start_on_boot: true,
        tags: ["playwright", "browser", "mcp", "npx"]
      }
    }
  };
  return { raw, config };
}
