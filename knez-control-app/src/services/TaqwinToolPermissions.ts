import { knezClient } from "./KnezClient";

type Permissions = Record<string, boolean>;

const STORAGE_KEY = "taqwin_tool_permissions_v2";

const SAFE_TOOLS_UNTRUSTED = new Set<string>([
  "get_server_status",
  "connection_info",
  "debug_test",
  "web_intelligence",
  "session",
  "session_v2"
]);

export function getTaqwinToolPermissions(): Permissions {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Permissions;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function setTaqwinToolEnabled(tool: string, enabled: boolean) {
  const next = { ...getTaqwinToolPermissions(), [tool]: enabled };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function isTaqwinToolAllowed(tool: string): boolean {
  const trust = knezClient.getProfile().trustLevel;
  const enabledPref = getTaqwinToolPermissions()[tool];
  const enabled = enabledPref !== false;
  if (!enabled) return false;
  if (trust === "verified") return true;
  return SAFE_TOOLS_UNTRUSTED.has(tool);
}
