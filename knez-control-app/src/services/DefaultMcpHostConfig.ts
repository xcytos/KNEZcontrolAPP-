import { McpHostConfig } from "./McpHostConfig";

export function getDefaultMcpHostConfig(): { raw: string; config: McpHostConfig } {
  const config: McpHostConfig = {
    mcpServers: {
      taqwin: {
        id: "taqwin",
        command: "C:\\\\Users\\\\syedm\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python313\\\\python.exe",
        args: [
          "-u",
          "C:\\\\Users\\\\syedm\\\\Downloads\\\\ASSETS\\\\controlAPP\\\\TAQWIN_V1\\\\main.py"
        ],
        cwd: "C:\\\\Users\\\\syedm\\\\Downloads\\\\ASSETS\\\\controlAPP\\\\TAQWIN_V1",
        env: { PYTHONUNBUFFERED: "1" }
      }
    }
  };
  return { raw: JSON.stringify(config, null, 2), config };
}

