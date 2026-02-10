import type { McpConfigInput, McpServerConfig } from "./McpHostConfig";

const INPUT_REF_RE = /\$\{input:([a-zA-Z0-9_-]+)\}/g;

export function extractInputRefs(value: any): string[] {
  const out = new Set<string>();
  const walk = (v: any) => {
    if (v === null || v === undefined) return;
    if (typeof v === "string") {
      for (const m of v.matchAll(INPUT_REF_RE)) {
        const id = String(m[1] ?? "").trim();
        if (id) out.add(id);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const it of v) walk(it);
      return;
    }
    if (typeof v === "object") {
      for (const it of Object.values(v)) walk(it);
    }
  };
  walk(value);
  return Array.from(out);
}

export function substituteInputRefs<T>(value: T, resolved: Record<string, string>): T {
  const walk = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (typeof v === "string") {
      return v.replace(INPUT_REF_RE, (_, idRaw) => {
        const id = String(idRaw ?? "").trim();
        if (!id) return "";
        const repl = resolved[id];
        return repl === undefined ? `\${input:${id}}` : String(repl);
      });
    }
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === "object") {
      const next: any = {};
      for (const [k, it] of Object.entries(v)) next[k] = walk(it);
      return next;
    }
    return v;
  };
  return walk(value);
}

export function listInputsById(inputs: McpConfigInput[]): Record<string, McpConfigInput> {
  const out: Record<string, McpConfigInput> = {};
  for (const it of inputs ?? []) {
    if (!it?.id) continue;
    out[it.id] = it;
  }
  return out;
}

export function extractServerInputRefs(server: McpServerConfig): string[] {
  if ((server as any)?.type === "http") {
    return extractInputRefs((server as any)?.headers ?? {});
  }
  return extractInputRefs((server as any)?.env ?? {});
}

export function substituteServerInputRefs(server: McpServerConfig, resolved: Record<string, string>): McpServerConfig {
  if ((server as any)?.type === "http") {
    const headers = substituteInputRefs((server as any)?.headers ?? {}, resolved);
    return { ...(server as any), headers };
  }
  const env = substituteInputRefs((server as any)?.env ?? {}, resolved);
  return { ...(server as any), env };
}

