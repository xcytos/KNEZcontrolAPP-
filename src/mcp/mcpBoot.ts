import { mcpInspectorService } from "./inspector/McpInspectorService";

let started = false;

export async function initMcpBoot(): Promise<void> {
  if (started) return;
  started = true;
  await mcpInspectorService.loadConfig();
}

