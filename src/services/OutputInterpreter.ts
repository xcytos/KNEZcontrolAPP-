// P2.6 — OUTPUT INTERPRETER LAYER
// Structured parsing only. No regex string matching.
// Laws: AI is the only entity that produces user-visible output.
// Phase 3: Schema validation and strict canonical type enforcement

export type OutputClass = "plain_text" | "tool_call" | "system_payload" | "invalid_fragment";

export interface ToolCallPayload {
  name: string;
  arguments: Record<string, any>;
}

export interface InterpretResult {
  classification: OutputClass;
  toolCall?: ToolCallPayload;
  systemKeys?: string[];
}

const SYSTEM_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "delegation_strategy",
  "enable_council",
  "request_rationale",
  "system_directive",
  "system_action",
  "mcp_command",
  "taqwin_directive",
  "knez_internal",
]);

/**
 * Classify a complete model output string.
 * Uses structured JSON.parse — no regex.
 * Phase 3: Schema validation and strict canonical type enforcement
 */
export function interpretOutput(text: string): InterpretResult {
  const trimmed = text.trim();

  if (!trimmed) {
    // Log: empty input
    return { classification: "invalid_fragment" };
  }

  // Fast path: if the output doesn't start with '{', it is plain text.
  if (!trimmed.startsWith("{")) {
    return { classification: "plain_text" };
  }

  // Attempt structured parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Starts with '{' but is not valid JSON.
    // If there's substantial non-JSON text before the brace, treat as plain_text.
    const braceIdx = text.indexOf("{");
    const leadingText = text.slice(0, braceIdx).trim();
    if (leadingText.length > 20) {
      return { classification: "plain_text" };
    }
    // Log: invalid JSON
    return { classification: "invalid_fragment" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { classification: "plain_text" };
  }

  const obj = parsed as Record<string, unknown>;

  // ─── tool_call shape with schema validation ───────────────────────────────
  if (obj.tool_call && typeof obj.tool_call === "object") {
    const tc = obj.tool_call as Record<string, unknown>;
    const name = String(tc.name ?? "").trim();
    const args = tc.arguments && typeof tc.arguments === "object" && !Array.isArray(tc.arguments)
      ? (tc.arguments as Record<string, any>)
      : {};

    // Schema validation: tool_call must have name and arguments only
    const tcKeys = Object.keys(tc);
    if (tcKeys.length !== 2 || !tcKeys.includes("name") || !tcKeys.includes("arguments")) {
      // Log: invalid tool_call schema - extra keys or missing required keys
      return { classification: "invalid_fragment" };
    }

    if (!name) {
      // Log: tool_call missing name
      return { classification: "invalid_fragment" };
    }

    return {
      classification: "tool_call",
      toolCall: { name, arguments: args },
    };
  }

  // ─── tool_calls array shape with schema validation ───────────────────────
  if (Array.isArray(obj.tool_calls) && obj.tool_calls.length > 0) {
    const first = obj.tool_calls[0] as Record<string, any>;
    const fn = first?.function ?? first;
    const name = String(fn?.name ?? "").trim();
    const args = fn?.arguments && typeof fn.arguments === "object" ? fn.arguments : {};

    if (!name) {
      // Log: tool_calls array missing name
      return { classification: "invalid_fragment" };
    }

    return {
      classification: "tool_call",
      toolCall: { name, arguments: args },
    };
  }

  // ─── system payload shape ───────────────────────────────────────────────
  const foundSystemKeys = Object.keys(obj).filter((k) => SYSTEM_PAYLOAD_KEYS.has(k));
  if (foundSystemKeys.length > 0) {
    return { classification: "system_payload", systemKeys: foundSystemKeys };
  }

  // Any other JSON the model emits is treated as a system payload (not user-visible).
  return { classification: "system_payload" };
}

/**
 * Returns true when the buffer is large enough to make a confident classification.
 *
 * For plain_text: true as soon as the first non-whitespace char is not '{'.
 * For JSON types: true when all braces are balanced (complete JSON object).
 */
export function canClassifyEarly(buffer: string): boolean {
  const trimmed = buffer.trimStart();
  if (!trimmed) return false;

  // If it doesn't start with '{', we already know it's plain_text.
  if (!trimmed.startsWith("{")) return true;

  // For JSON, wait until braces are balanced.
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (const ch of trimmed) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return true; // balanced → complete JSON
    }
  }

  return false;
}
