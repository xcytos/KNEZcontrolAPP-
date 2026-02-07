import { McpToolDefinition } from "./McpTypes";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

class TaqwinMcpService {
  private client: import("./McpStdioClient").McpStdioClient | null = null;
  private initialized = false;
  private toolsCache: McpToolDefinition[] | null = null;

  private async getClient(): Promise<import("./McpStdioClient").McpStdioClient> {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    if (!this.client) {
      const { McpStdioClient } = await import("./McpStdioClient");
      this.client = new McpStdioClient();
      await this.client.start("taqwin-mcp");
      this.initialized = false;
      this.toolsCache = null;
    }
    if (!this.initialized) {
      await this.client.initialize();
      this.initialized = true;
    }
    return this.client;
  }

  async listTools(forceRefresh = false): Promise<McpToolDefinition[]> {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    if (this.toolsCache && !forceRefresh) return this.toolsCache;
    const client = await this.getClient();
    const tools = await client.listTools();
    this.toolsCache = tools;
    return tools;
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!isTauriRuntime()) throw new Error("mcp_unavailable_non_tauri");
    const client = await this.getClient();
    return await client.callTool(name, args);
  }
}

export const taqwinMcpService = new TaqwinMcpService();
