export const MCP_LOG_METHODS = {
  SERVER_START: "MCPServerManager#start",
  SERVER_STOP: "MCPServerManager#stop",
  CLIENT_START: "MCPClient#start",
  CLIENT_STOP: "MCPClient#stop",
  INITIALIZE: "MCPClient#initialize",
  INITIALIZE_ATTEMPT: "MCPClient#initializeAttempt",
  NOTIFY_INITIALIZED: "MCPClient#notifyInitialized",
  LIST_TOOLS: "MCPServerManager#listTools",
  CALL_TOOL: "MCPServerManager#callTool",
  REQUEST: "MCPClient#request",
  RESPONSE: "MCPClient#response",
} as const;

export const MCP_LOG_CATEGORIES = {
  PREFIX_LOCAL: (serverId: string) => `mcp.local.${serverId}`,
  PREFIX_CONFIG: (serverId: string) => `mcp.config.usrlocalmcp.${serverId}`,
  GENERIC: "mcp",
  AUDIT: "mcp_audit",
} as const;
