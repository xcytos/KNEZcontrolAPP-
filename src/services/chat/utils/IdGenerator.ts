// ─── IdGenerator.ts ─────────────────────────────────────────────────
// Utility for generating unique IDs for messages, requests, streams
// ─────────────────────────────────────────────────────────────────────────────

export function generateMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

export function generateRequestId(): string {
  return generateMessageId();
}

export function generateStreamId(): string {
  return generateMessageId();
}
