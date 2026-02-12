export function inferStdioPreferredFraming(input: {
  command: string;
  args?: string[];
  env?: Record<string, string> | null;
}): "content-length" | "line" {
  const forced = String(input.env?.KNEZ_MCP_CLIENT_FRAMING ?? "").trim().toLowerCase();
  if (forced === "line" || forced === "content-length") return forced;
  const cmdLower = String(input.command ?? "").toLowerCase();
  const base = cmdLower.split(/[\\/]/).pop() ?? cmdLower;
  const isNpx = base === "npx" || base === "npx.cmd";
  const argsLower = (input.args ?? []).map((a) => String(a ?? "").toLowerCase());
  const looksLikeMcpNpx = isNpx || argsLower.some((a) => a.includes("@modelcontextprotocol/") || a.includes("server-puppeteer"));
  return looksLikeMcpNpx ? "line" : "content-length";
}

export function inferInitializeTimeoutMs(input: { command?: string | null; args?: string[] | null }): number {
  const cmd = String(input.command ?? "");
  const base = cmd.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  if (base === "npx" || base === "npx.cmd") return 60000;
  if ((input.args ?? []).some((a) => String(a ?? "").toLowerCase().includes("@modelcontextprotocol/"))) return 60000;
  return 15000;
}

