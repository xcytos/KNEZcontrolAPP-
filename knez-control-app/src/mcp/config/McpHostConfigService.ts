import { BaseDirectory, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { McpHostConfig, parseMcpHostConfigJson, validateTaqwinMcpServer } from "./McpHostConfig";
import { getDefaultMcpHostConfig } from "./DefaultMcpHostConfig";

const APP_LOCAL_FILE_NAME = "mcp.config.json";
const LEGACY_APP_LOCAL_FILE_NAME = "mcp.host.json";
const USER_CONFIG_RELATIVE = ".config/knez/mcp-config.json";
const PROJECT_CONFIG_FILE_NAME = "mcp-config.json";

export class McpHostConfigService {
  private async loadFromUserConfig(): Promise<{ raw: string; config: McpHostConfig } | null> {
    try {
      const raw = await readTextFile(USER_CONFIG_RELATIVE, { baseDir: BaseDirectory.Home });
      const config = parseMcpHostConfigJson(raw);
      return { raw, config };
    } catch {
      return null;
    }
  }

  private async loadFromProjectRoot(): Promise<{ raw: string; config: McpHostConfig } | null> {
    try {
      const raw = await readTextFile(PROJECT_CONFIG_FILE_NAME, { baseDir: BaseDirectory.Resource });
      const config = parseMcpHostConfigJson(raw);
      return { raw, config };
    } catch {
      return null;
    }
  }

  private async loadFromAppLocal(): Promise<{ raw: string; config: McpHostConfig } | null> {
    try {
      const raw = await readTextFile(APP_LOCAL_FILE_NAME, { baseDir: BaseDirectory.AppLocalData });
      const config = parseMcpHostConfigJson(raw);
      return { raw, config };
    } catch {
      try {
        const raw = await readTextFile(LEGACY_APP_LOCAL_FILE_NAME, { baseDir: BaseDirectory.AppLocalData });
        const config = parseMcpHostConfigJson(raw);
        try {
          const migrated = JSON.stringify({ schema_version: "1", servers: config.servers }, null, 2);
          await writeTextFile(APP_LOCAL_FILE_NAME, migrated, { baseDir: BaseDirectory.AppLocalData });
          return { raw: migrated, config };
        } catch {
          return { raw, config };
        }
      } catch {
        return null;
      }
    }
  }

  async load(): Promise<{ raw: string; config: McpHostConfig } | null> {
    const userCfg = await this.loadFromUserConfig();
    if (userCfg) return userCfg;

    const projectCfg = await this.loadFromProjectRoot();
    if (projectCfg) return projectCfg;

    const appLocalCfg = await this.loadFromAppLocal();
    if (appLocalCfg) return appLocalCfg;

    return null;
  }

  getDefault(): { raw: string; config: McpHostConfig } {
    return getDefaultMcpHostConfig();
  }

  async save(raw: string): Promise<{ config: McpHostConfig; issues: Record<string, ReturnType<typeof validateTaqwinMcpServer>> }> {
    const config = parseMcpHostConfigJson(raw);
    const issues: Record<string, ReturnType<typeof validateTaqwinMcpServer>> = {};
    for (const [name, server] of Object.entries(config.servers)) {
      issues[name] = validateTaqwinMcpServer(server);
    }
    await writeTextFile(APP_LOCAL_FILE_NAME, raw, { baseDir: BaseDirectory.AppLocalData });
    return { config, issues };
  }
}

export const mcpHostConfigService = new McpHostConfigService();
