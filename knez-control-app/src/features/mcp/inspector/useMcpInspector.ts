import { useEffect, useState } from "react";
import { mcpInspectorService } from "../../../mcp/inspector/McpInspectorService";

export function useMcpInspector() {
  const [, bump] = useState(0);
  useEffect(() => mcpInspectorService.subscribe(() => bump((v) => (v + 1) % 1000000)), []);
  return mcpInspectorService;
}

