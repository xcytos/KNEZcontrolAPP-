import type { McpServerConfig } from "../config/McpHostConfig";

export function extractConnectionParams(server: McpServerConfig) {
  if (server.type === "http") {
    return {
      url: server.url,
      headers: Object.keys(server.headers ?? {}),
      type: "http" as const
    };
  }
  return {
    command: server.command,
    args: server.args,
    cwd: server.cwd,
    env: server.env,
    env_keys: Object.keys(server.env ?? {}),
    path: typeof process !== "undefined" ? process.env.PATH : undefined,
    type: "stdio" as const
  };
}

export function formatJsonRpcPayload(json: any, maxBytes: number = 2000): string {
  const str = JSON.stringify(json);
  if (str.length <= maxBytes) return str;
  return str.slice(0, maxBytes) + "... (truncated)";
}
