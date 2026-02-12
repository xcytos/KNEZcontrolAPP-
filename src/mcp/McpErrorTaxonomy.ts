export type McpErrorClassification = { code: string; message: string };

export function classifyMcpError(rawError: unknown): McpErrorClassification {
  const raw = String((rawError as any)?.message ?? rawError ?? "");
  const lower = raw.toLowerCase();
  if (lower.includes("mcp_permission_denied") || lower.includes("permission_denied")) return { code: "mcp_permission_denied", message: raw };
  if (lower.includes("mcp_tool_not_found")) return { code: "mcp_tool_not_found", message: raw };
  if (lower.includes("mcp_server_not_found")) return { code: "mcp_server_not_found", message: raw };
  if (lower.includes("mcp_not_ready") || lower.includes("mcp_server_not_ready")) return { code: "mcp_server_not_ready", message: raw };
  if (lower.includes("mcp_not_started") || lower.includes("mcp_not_initialized")) return { code: "mcp_server_not_ready", message: raw };
  if (lower.includes("mcp_server_disabled")) return { code: "mcp_server_disabled", message: raw };
  if (lower.includes("mcp_server_no_tools")) return { code: "mcp_server_no_tools", message: raw };
  if (lower.includes("timeout")) return { code: "mcp_timeout", message: raw };
  if (lower.includes("process") && lower.includes("closed")) return { code: "mcp_process_crashed", message: raw };
  return { code: "mcp_tool_execution_error", message: raw };
}

