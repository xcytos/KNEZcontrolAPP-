export type McpAuthority = "ts" | "rust";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

export function getMcpAuthority(): McpAuthority {
  if (!isTauriRuntime()) return "ts";
  const w = window as any;
  const fromWindow = String(w.__KNEZ_MCP_AUTHORITY ?? "").trim().toLowerCase();
  const fromStorage = (() => {
    try {
      return String(localStorage.getItem("knez_mcp_authority") ?? "").trim().toLowerCase();
    } catch {
      return "";
    }
  })();
  const fromEnv = String((import.meta as any)?.env?.VITE_MCP_AUTHORITY ?? "").trim().toLowerCase();
  const raw = fromWindow || fromStorage || fromEnv || "rust";
  return raw === "ts" ? "ts" : "rust";
}
