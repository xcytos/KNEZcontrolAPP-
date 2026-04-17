const KEY_KEEP_ALIVE = "knez.keepAlive";

export function getKeepAliveEnabled(): boolean {
  try {
    const v = localStorage.getItem(KEY_KEEP_ALIVE);
    if (v === null) return true;
    return v === "true";
  } catch (e) {
    // localStorage not available (private browsing, quota exceeded, etc.)
    return true;
  }
}

export function setKeepAliveEnabled(enabled: boolean) {
  try {
    localStorage.setItem(KEY_KEEP_ALIVE, enabled ? "true" : "false");
  } catch (e) {
    // localStorage not available (private browsing, quota exceeded, etc.)
    // Silently fail - keepAliveEnabled will default to true
  }
}

