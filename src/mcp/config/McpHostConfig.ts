export type McpConfigInput = {
  type: "promptString";
  id: string;
  description?: string;
  password?: boolean;
};

export type McpStdioServerConfig = {
  id: string;
  type?: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
  enabled?: boolean;
  tags?: string[];
};

export type McpHttpServerConfig = {
  id: string;
  type: "http";
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  tags?: string[];
};

export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

export type McpHostConfig = {
  schema_version?: string;
  inputs?: McpConfigInput[];
  servers: Record<string, McpServerConfig>;
};

export type NormalizedMcpStdioServerConfig = {
  id: string;
  type: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
  enabled: boolean;
  tags: string[];
};

export type NormalizedMcpHttpServerConfig = {
  id: string;
  type: "http";
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
  tags: string[];
};

export type NormalizedMcpServerConfig = NormalizedMcpStdioServerConfig | NormalizedMcpHttpServerConfig;

export type NormalizedMcpConfig = {
  schema_version?: string;
  inputs: McpConfigInput[];
  servers: Record<string, NormalizedMcpServerConfig>;
  sourceSchema: "servers" | "mcpServers" | "unknown";
};

export type McpConfigIssue = {
  level: "error" | "warn";
  message: string;
  field?: string;
};

function isAbsolutePath(p: string): boolean {
  if (!p) return false;
  if (/^[a-zA-Z]:[\\/]/.test(p)) return true;
  if (p.startsWith("\\\\")) return true;
  if (p.startsWith("/")) return true;
  return false;
}

function toRecord(v: any): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!k) continue;
    if (val === null || val === undefined) continue;
    out[String(k)] = String(val);
  }
  return out;
}

function dirname(p: string): string {
  const s = String(p ?? "");
  const idx = Math.max(s.lastIndexOf("\\"), s.lastIndexOf("/"));
  if (idx <= 0) return "";
  return s.slice(0, idx).replace(/[\\/]+$/, "");
}

export function normalizeMcpConfig(input: any): NormalizedMcpConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("mcp_config_invalid: expected object");
  }
  const schema_version = (input as any).schema_version ? String((input as any).schema_version) : undefined;
  const inputs: McpConfigInput[] = Array.isArray((input as any).inputs)
    ? (input as any).inputs
        .filter((v: any) => v && typeof v === "object" && !Array.isArray(v))
        .map((v: any) => ({
          type: "promptString",
          id: String(v.id ?? "").trim(),
          description: v.description ? String(v.description) : undefined,
          password: typeof v.password === "boolean" ? v.password : undefined,
        }))
        .filter((v: McpConfigInput) => !!v.id)
    : [];
  const hasServers = !!(input as any).servers;
  const hasMcpServers = !!(input as any).mcpServers;
  const sourceSchema: NormalizedMcpConfig["sourceSchema"] = hasServers ? "servers" : hasMcpServers ? "mcpServers" : "unknown";
  const serversRaw = hasServers ? (input as any).servers : hasMcpServers ? (input as any).mcpServers : null;
  if (!serversRaw || typeof serversRaw !== "object" || Array.isArray(serversRaw)) {
    throw new Error("mcp_config_invalid: expected {servers:{...}} or {mcpServers:{...}}");
  }

  const servers: Record<string, NormalizedMcpServerConfig> = {};
  for (const [name, entry] of Object.entries(serversRaw)) {
    if (!name) continue;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const enabled = typeof (entry as any).enabled === "boolean" ? (entry as any).enabled : true;
    const tags = Array.isArray((entry as any).tags) ? (entry as any).tags.map((t: any) => String(t)) : [];

    const rawType = String((entry as any).type ?? "").trim().toLowerCase();
    const hasUrl = typeof (entry as any).url === "string" && String((entry as any).url).trim().length > 0;
    const isHttp = rawType === "http" || hasUrl;

    if (isHttp) {
      const url = String((entry as any).url ?? "").trim();
      const headers = toRecord((entry as any).headers);
      servers[name] = { id: name, type: "http", url, headers, enabled, tags };
      continue;
    }

    const command = String((entry as any).command ?? "");
    const args = Array.isArray((entry as any).args) ? (entry as any).args.map((a: any) => String(a)) : [];
    const env = toRecord((entry as any).env);
    let cwd =
      (entry as any).cwd
        ? String((entry as any).cwd)
        : (entry as any).working_directory
          ? String((entry as any).working_directory)
          : (entry as any).workingDirectory
            ? String((entry as any).workingDirectory)
            : undefined;

    if (!cwd) {
      const main = args.find((a: string) => /main\.py$/i.test(a)) ?? "";
      if (main && isAbsolutePath(main)) cwd = dirname(main) || undefined;
    }

    servers[name] = { id: name, type: "stdio", command, args, env, cwd, enabled, tags };
  }
  return { schema_version, inputs, servers, sourceSchema };
}

export function parseMcpHostConfigJson(raw: string): McpHostConfig {
  const parsed = JSON.parse(raw);
  const normalized = normalizeMcpConfig(parsed);
  const servers: Record<string, McpServerConfig> = {};
  for (const [k, s] of Object.entries(normalized.servers)) {
    servers[k] = { ...s };
  }
  return { schema_version: normalized.schema_version, inputs: normalized.inputs, servers };
}

export function validateTaqwinMcpServer(server: McpServerConfig): McpConfigIssue[] {
  const issues: McpConfigIssue[] = [];

  if ((server as any)?.type === "http") {
    issues.push({ level: "error", message: "TAQWIN must be configured as a stdio server", field: "type" });
    return issues;
  }

  if (!server.command) issues.push({ level: "error", message: "command is required", field: "command" });
  if (server.command && !isAbsolutePath(server.command) && server.command.toLowerCase() !== "python") {
    issues.push({ level: "warn", message: "command is not an absolute path", field: "command" });
  }
  if (server.cwd && !isAbsolutePath(server.cwd)) {
    issues.push({ level: "warn", message: "cwd is not an absolute path", field: "cwd" });
  }
  if (!Array.isArray(server.args)) issues.push({ level: "error", message: "args must be an array", field: "args" });

  const hasU = server.args.some((a) => a === "-u");
  if (!hasU) issues.push({ level: "error", message: "args must include -u (unbuffered)", field: "args" });

  const hasMain = server.args.some((a) => /main\.py$/i.test(a));
  if (!hasMain) issues.push({ level: "error", message: "args must include main.py", field: "args" });
  const mainArg = server.args.find((a) => /main\.py$/i.test(a)) ?? "";
  if (mainArg && !isAbsolutePath(mainArg)) issues.push({ level: "warn", message: "main.py path is not absolute", field: "args" });

  const env = server.env ?? {};
  if (String(env.PYTHONUNBUFFERED ?? "") !== "1") {
    issues.push({ level: "error", message: "env must include PYTHONUNBUFFERED=1", field: "env.PYTHONUNBUFFERED" });
  }

  return issues;
}

export function normalizeTaqwinMcpServer(server: McpServerConfig): McpServerConfig {
  if ((server as any)?.type === "http") return server;
  const env = { ...(server.env ?? {}) };
  if (!env.PYTHONUNBUFFERED) env.PYTHONUNBUFFERED = "1";
  const args = Array.isArray(server.args) ? server.args.slice() : [];
  if (!args.includes("-u")) args.unshift("-u");
  return { ...server, env, args };
}
