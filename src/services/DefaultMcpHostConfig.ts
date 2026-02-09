import { McpHostConfig } from "./McpHostConfig";

export function getDefaultMcpHostConfig(): { raw: string; config: McpHostConfig } {
  const rawObj = {
    schema_version: "1",
    servers: {
      taqwin: {
        command: "C:\\\\Users\\\\syedm\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python313\\\\python.exe",
        args: ["-u", "C:\\\\Users\\\\syedm\\\\Downloads\\\\ASSETS\\\\controlAPP\\\\TAQWIN_V1\\\\main.py"],
        working_directory: "C:\\\\Users\\\\syedm\\\\Downloads\\\\ASSETS\\\\controlAPP\\\\TAQWIN_V1",
        env: { PYTHONUNBUFFERED: "1" },
        enabled: true,
        tags: ["taqwin", "mcp"]
      }
    }
  };
  const raw = JSON.stringify(rawObj, null, 2);
  const config: McpHostConfig = {
    schema_version: "1",
    mcpServers: {
      taqwin: {
        id: "taqwin",
        command: String(rawObj.servers.taqwin.command),
        args: rawObj.servers.taqwin.args.slice(),
        cwd: String(rawObj.servers.taqwin.working_directory),
        env: { ...rawObj.servers.taqwin.env },
        enabled: true,
        tags: rawObj.servers.taqwin.tags.slice()
      }
    }
  };
  return { raw, config };
}
