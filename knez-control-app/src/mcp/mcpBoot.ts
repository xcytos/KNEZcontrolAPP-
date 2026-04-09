import { mcpInspectorService } from "./inspector/McpInspectorService";
import { mcpOrchestrator } from "./McpOrchestrator";

let started = false;

export async function initMcpBoot(): Promise<void> {
  if (started) return;
  started = true;
  await mcpInspectorService.loadConfig();
  await mcpOrchestrator.ensureStartedAll({ onlyEnabled: true, startOnBootOnly: false });
}
