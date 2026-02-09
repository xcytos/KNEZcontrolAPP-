import { BaseDirectory, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { McpHostConfig, parseMcpHostConfigJson, validateTaqwinMcpServer } from "./McpHostConfig";
import { getDefaultMcpHostConfig } from "./DefaultMcpHostConfig";

const FILE_NAME = "mcp.host.json";

export class McpHostConfigService {
  async load(): Promise<{ raw: string; config: McpHostConfig } | null> {
    try {
      const raw = await readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppLocalData });
      const config = parseMcpHostConfigJson(raw);
      return { raw, config };
    } catch {
      return null;
    }
  }

  getDefault(): { raw: string; config: McpHostConfig } {
    return getDefaultMcpHostConfig();
  }

  async save(raw: string): Promise<{ config: McpHostConfig; issues: Record<string, ReturnType<typeof validateTaqwinMcpServer>> }> {
    const config = parseMcpHostConfigJson(raw);
    const issues: Record<string, ReturnType<typeof validateTaqwinMcpServer>> = {};
    for (const [name, server] of Object.entries(config.mcpServers)) {
      issues[name] = validateTaqwinMcpServer(server);
    }
    await writeTextFile(FILE_NAME, raw, { baseDir: BaseDirectory.AppLocalData });
    return { config, issues };
  }
}

export const mcpHostConfigService = new McpHostConfigService();
