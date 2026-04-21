import { listen } from "@tauri-apps/api/event";
import { logger } from "../services/utils/LogService";
import { getMcpAuthority } from "./authority";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

function asObj(v: unknown): Record<string, any> {
  return typeof v === "object" && v !== null ? (v as any) : {};
}

async function init(): Promise<void> {
  if (!isTauriRuntime()) return;
  if (getMcpAuthority() !== "rust") return;

  await listen("mcp://state", (e) => {
    const p = asObj(e.payload);
    logger.info("mcp", "MCP state", p);
  });

  await listen("mcp://request", (e) => {
    const p = asObj(e.payload);
    logger.debug("mcp", "MCP request", p);
  });

  await listen("mcp://response", (e) => {
    const p = asObj(e.payload);
    logger.debug("mcp", "MCP response", p);
  });

  await listen("mcp://raw_stdout", (e) => {
    const p = asObj(e.payload);
    const serverId = String(p.serverId ?? "");
    logger.debugThrottled(`mcp_raw_stdout_${serverId}`, 250, "mcp", "MCP raw stdout", {
      serverId,
      pid: p.pid ?? null,
      generation: p.generation ?? null,
      textPreview: String(p.text ?? "").slice(0, 300)
    });
  });

  await listen("mcp://raw_stderr", (e) => {
    const p = asObj(e.payload);
    const serverId = String(p.serverId ?? "");
    logger.debugThrottled(`mcp_raw_stderr_${serverId}`, 250, "mcp", "MCP raw stderr", {
      serverId,
      pid: p.pid ?? null,
      generation: p.generation ?? null,
      textPreview: String(p.text ?? "").slice(0, 300)
    });
  });
}

void init();

