const KEY_KEEP_ALIVE = "knez.keepAlive";

export function getKeepAliveEnabled(): boolean {
  const v = localStorage.getItem(KEY_KEEP_ALIVE);
  if (v === null) return true;
  return v === "true";
}

export function setKeepAliveEnabled(enabled: boolean) {
  localStorage.setItem(KEY_KEEP_ALIVE, enabled ? "true" : "false");
}

