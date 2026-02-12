export function classifyMcpTimeout(method: string): string {
  if (method === "initialize") return "mcp_timeout_initialize";
  if (method === "tools/list") return "mcp_timeout_tools_list";
  if (method === "tools/call") return "mcp_timeout_tools_call";
  if (method === "shutdown") return "mcp_timeout_shutdown";
  return "mcp_timeout_request";
}

