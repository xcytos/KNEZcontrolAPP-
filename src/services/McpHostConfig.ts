export type McpServerConfig = {
  id: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
  enabled?: boolean;
  tags?: string[];
};

export type McpHostConfig = {
  schema_version?: string;
  mcpServers: Record<string, McpServerConfig>;
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

export function parseMcpHostConfigJson(raw: string): McpHostConfig {
  const parsed = JSON.parse(raw);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed as any).schema_version && (parsed as any).servers) {
    const serversRaw = (parsed as any).servers;
    if (!serversRaw || typeof serversRaw !== "object" || Array.isArray(serversRaw)) {
      throw new Error("mcp_config_invalid: servers must be an object");
    }
    const mcpServers: Record<string, McpServerConfig> = {};
    for (const [name, entry] of Object.entries(serversRaw)) {
      if (!name) continue;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const command = String((entry as any).command ?? "");
      const args = Array.isArray((entry as any).args) ? (entry as any).args.map((a: any) => String(a)) : [];
      const env = toRecord((entry as any).env);
      const cwd =
        (entry as any).cwd
          ? String((entry as any).cwd)
          : (entry as any).working_directory
            ? String((entry as any).working_directory)
            : (entry as any).workingDirectory
              ? String((entry as any).workingDirectory)
              : undefined;
      const enabled = typeof (entry as any).enabled === "boolean" ? (entry as any).enabled : undefined;
      const tags = Array.isArray((entry as any).tags) ? (entry as any).tags.map((t: any) => String(t)) : undefined;
      mcpServers[name] = { id: name, command, args, env, cwd, enabled, tags };
    }
    return { schema_version: String((parsed as any).schema_version), mcpServers };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed as any).mcpServers) {
    const mcpServersRaw = (parsed as any).mcpServers;
    if (!mcpServersRaw || typeof mcpServersRaw !== "object" || Array.isArray(mcpServersRaw)) {
      throw new Error("mcp_config_invalid: mcpServers must be an object");
    }
    const mcpServers: Record<string, McpServerConfig> = {};
    for (const [name, entry] of Object.entries(mcpServersRaw)) {
      if (!name) continue;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const command = String((entry as any).command ?? "");
      const args = Array.isArray((entry as any).args) ? (entry as any).args.map((a: any) => String(a)) : [];
      const env = toRecord((entry as any).env);
      const cwd =
        (entry as any).cwd
          ? String((entry as any).cwd)
          : (entry as any).working_directory
            ? String((entry as any).working_directory)
            : (entry as any).workingDirectory
              ? String((entry as any).workingDirectory)
              : undefined;
      const enabled = typeof (entry as any).enabled === "boolean" ? (entry as any).enabled : undefined;
      const tags = Array.isArray((entry as any).tags) ? (entry as any).tags.map((t: any) => String(t)) : undefined;
      mcpServers[name] = { id: name, command, args, env, cwd, enabled, tags };
    }
    return { mcpServers };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed as any).servers) {
    const serversRaw = (parsed as any).servers;
    if (!serversRaw || typeof serversRaw !== "object" || Array.isArray(serversRaw)) {
      throw new Error("mcp_config_invalid: servers must be an object");
    }
    const mcpServers: Record<string, McpServerConfig> = {};
    for (const [name, entry] of Object.entries(serversRaw)) {
      if (!name) continue;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const command = String((entry as any).command ?? "");
      const args = Array.isArray((entry as any).args) ? (entry as any).args.map((a: any) => String(a)) : [];
      const env = toRecord((entry as any).env);
      const cwd =
        (entry as any).cwd
          ? String((entry as any).cwd)
          : (entry as any).working_directory
            ? String((entry as any).working_directory)
            : (entry as any).workingDirectory
              ? String((entry as any).workingDirectory)
            : undefined;
      const enabled = typeof (entry as any).enabled === "boolean" ? (entry as any).enabled : undefined;
      const tags = Array.isArray((entry as any).tags) ? (entry as any).tags.map((t: any) => String(t)) : undefined;
      mcpServers[name] = { id: name, command, args, env, cwd, enabled, tags };
    }
    return { mcpServers };
  }

  throw new Error("mcp_config_invalid: expected {mcpServers:{...}} or {servers:{...}}");
}

export function validateTaqwinMcpServer(server: McpServerConfig): McpConfigIssue[] {
  const issues: McpConfigIssue[] = [];

  if (!server.command) issues.push({ level: "error", message: "command is required", field: "command" });
  if (server.command && !isAbsolutePath(server.command)) {
    issues.push({ level: "error", message: "command must be an absolute path", field: "command" });
  }
  if (!server.cwd) {
    issues.push({ level: "error", message: "cwd is required and must point to TAQWIN_V1", field: "cwd" });
  } else if (!isAbsolutePath(server.cwd)) {
    issues.push({ level: "error", message: "cwd must be an absolute path", field: "cwd" });
  }
  if (!Array.isArray(server.args)) issues.push({ level: "error", message: "args must be an array", field: "args" });

  const hasU = server.args.some((a) => a === "-u");
  if (!hasU) issues.push({ level: "error", message: "args must include -u (unbuffered)", field: "args" });

  const hasMain = server.args.some((a) => /main\.py$/i.test(a));
  if (!hasMain) issues.push({ level: "error", message: "args must include an absolute path to main.py", field: "args" });
  const mainArg = server.args.find((a) => /main\.py$/i.test(a)) ?? "";
  if (mainArg && !isAbsolutePath(mainArg)) issues.push({ level: "error", message: "main.py path must be absolute", field: "args" });

  const env = server.env ?? {};
  if (String(env.PYTHONUNBUFFERED ?? "") !== "1") {
    issues.push({ level: "error", message: "env must include PYTHONUNBUFFERED=1", field: "env.PYTHONUNBUFFERED" });
  }

  return issues;
}

export function normalizeTaqwinMcpServer(server: McpServerConfig): McpServerConfig {
  const env = { ...(server.env ?? {}) };
  if (!env.PYTHONUNBUFFERED) env.PYTHONUNBUFFERED = "1";
  const args = Array.isArray(server.args) ? server.args.slice() : [];
  if (!args.includes("-u")) args.unshift("-u");
  return { ...server, env, args };
}
