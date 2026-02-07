import { knezClient } from "./KnezClient";

type Permissions = Record<string, boolean>;

const STORAGE_KEY = "taqwin_tool_permissions_v1";

const DEFAULT_ENABLED: Permissions = {
  analyze: true,
  session: true,
  session_v2: true
};

export function getTaqwinToolPermissions(): Permissions {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_ENABLED };
  try {
    const parsed = JSON.parse(raw) as Permissions;
    return { ...DEFAULT_ENABLED, ...parsed };
  } catch {
    return { ...DEFAULT_ENABLED };
  }
}

export function setTaqwinToolEnabled(tool: string, enabled: boolean) {
  const next = { ...getTaqwinToolPermissions(), [tool]: enabled };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function isTaqwinToolAllowed(tool: string): boolean {
  const trust = knezClient.getProfile().trustLevel;
  const enabled = !!getTaqwinToolPermissions()[tool];
  if (!enabled) return false;
  if (trust === "verified") return true;
  return tool === "analyze" || tool === "session" || tool === "session_v2";
}

