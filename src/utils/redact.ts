const SENSITIVE_KEY_RE = /(authorization|cookie|set-cookie|token|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password)/i;

export function redactString(input: string): string {
  let s = input;
  s = s.replace(/(Bearer\\s+)[A-Za-z0-9\\-_.=:+/]+/gi, "$1[REDACTED]");
  s = s.replace(/([?&](?:token|access_token|refresh_token|api_key|apikey|key|secret|password)=)[^&\\s]+/gi, "$1[REDACTED]");
  s = s.replace(/(\"(?:access_token|refresh_token|api_key|apikey|token|secret|password)\"\\s*:\\s*\")[^\"]+(\")/gi, "$1[REDACTED]$2");
  return s;
}

export function redactAny(value: any): any {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(redactAny);
  if (typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactAny(v);
      }
    }
    return out;
  }
  try {
    return redactString(String(value));
  } catch {
    return "[REDACTED]";
  }
}
