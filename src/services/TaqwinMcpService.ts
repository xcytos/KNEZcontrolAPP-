import { McpToolDefinition } from "./McpTypes";

function isTauriRuntime(): boolean {
  return !!(window as any).__TAURI__ || !!(window as any).__TAURI_IPC__;
}

const FALLBACK_TOOLS: McpToolDefinition[] = [
  { name: "analyze", description: "TAQWIN bounded analysis", inputSchema: { type: "object" } },
  { name: "session", description: "TAQWIN session tool", inputSchema: { type: "object" } },
  { name: "session_v2", description: "TAQWIN v2 session tool", inputSchema: { type: "object" } },
  { name: "web_intelligence", description: "TAQWIN web intelligence", inputSchema: { type: "object" } },
  { name: "scan_database", description: "TAQWIN database scan", inputSchema: { type: "object" } }
];

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
    if (!isTauriRuntime()) return FALLBACK_TOOLS;
    if (this.toolsCache && !forceRefresh) return this.toolsCache;
    const client = await this.getClient();
    const tools = await client.listTools();
    this.toolsCache = tools;
    return tools;
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!isTauriRuntime()) {
      return { content: [{ type: "text", text: `[MOCK] tool=${name} args=${JSON.stringify(args ?? {})}` }] };
    }
    const client = await this.getClient();
    return await client.callTool(name, args);
  }
}

export const taqwinMcpService = new TaqwinMcpService();
