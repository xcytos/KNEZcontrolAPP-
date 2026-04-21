import { invoke } from "@tauri-apps/api/core";
import type { McpToolDefinition } from "../../services/mcp/McpTypes";
import type { McpTrafficEvent } from "../inspector/McpTraffic";
import { isStdioServer, type McpServerConfig } from "../config/McpHostConfig";

type RustStatus = {
  running: boolean;
  state: string;
  pid: number | null;
  framing: string | null;
  protocol_version: string | null;
  tools_cached: number;
  last_error: string | null;
};

export class McpRustClient {
  private lastStatus: RustStatus | null = null;
  private stdoutTail: string | null = null;
  private stderrTail: string | null = null;
  private lastTraffic: McpTrafficEvent[] = [];

  async startWithConfig(server: McpServerConfig): Promise<void> {
    if (!isStdioServer(server)) throw new Error("mcp_config_invalid_type: expected stdio");
    await invoke("mcp_start", {
      cfg: {
        id: server.id,
        command: server.command,
        args: Array.isArray(server.args) ? server.args : [],
        cwd: server.cwd ?? null,
        env: server.env ?? null,
        framing: String((server.env as any)?.KNEZ_MCP_CLIENT_FRAMING ?? "").trim() || null
      }
    });
    await this.refreshStatusAndTails();
  }

  async stop(): Promise<void> {
    await invoke("mcp_stop");
    await this.refreshStatusAndTails();
  }

  async initialize(): Promise<any> {
    await this.refreshStatusAndTails();
    if (this.lastStatus?.state !== "READY") throw new Error("mcp_not_ready");
    return {};
  }

  async notifyInitialized(): Promise<void> {}

  async listTools(_opts?: { timeoutMs?: number }): Promise<McpToolDefinition[]> {
    const res = await invoke("mcp_list_tools");
    await this.refreshStatusAndTails();
    return Array.isArray(res) ? (res as any) : [];
  }

  async callTool(name: string, args: any, opts?: { timeoutMs?: number }): Promise<any> {
    const timeoutMs = opts?.timeoutMs ?? 180000;
    const res = await invoke("mcp_request", {
      method: "tools/call",
      params: { name, arguments: args },
      timeoutMs
    });
    await this.refreshStatusAndTails();
    return res;
  }

  getTraffic(): McpTrafficEvent[] {
    return this.lastTraffic.slice();
  }

  async getTrafficAsync(): Promise<McpTrafficEvent[]> {
    const res = await invoke("mcp_get_traffic");
    return Array.isArray(res) ? (res as any) : [];
  }

  getDebugState(): {
    running: boolean;
    pid: number | null;
    requestFraming: string | null;
    stdoutTail: string | null;
    stderrTail: string | null;
    lastError: string | null;
  } {
    return {
      running: this.lastStatus?.running ?? false,
      pid: this.lastStatus?.pid ?? null,
      requestFraming: this.lastStatus?.framing ?? null,
      stdoutTail: this.stdoutTail,
      stderrTail: this.stderrTail,
      lastError: this.lastStatus?.last_error ?? null
    };
  }

  private async refreshStatusAndTails(): Promise<void> {
    const status = (await invoke("mcp_status")) as any;
    this.lastStatus = {
      running: Boolean(status?.running),
      state: String(status?.state ?? "UNKNOWN"),
      pid: typeof status?.pid === "number" ? status.pid : null,
      framing: typeof status?.framing === "string" ? status.framing : null,
      protocol_version: typeof status?.protocol_version === "string" ? status.protocol_version : null,
      tools_cached: Number(status?.tools_cached ?? 0),
      last_error: status?.last_error ? String(status.last_error) : null
    };

    const traffic = await this.getTrafficAsync();
    this.lastTraffic = traffic;
    const stdout = traffic.filter((e: any) => e?.kind === "raw_stdout").map((e: any) => String(e?.text ?? ""));
    const stderr = traffic.filter((e: any) => e?.kind === "raw_stderr").map((e: any) => String(e?.text ?? ""));
    this.stdoutTail = stdout.slice(-30).join("\n").slice(-4000) || null;
    this.stderrTail = stderr.slice(-30).join("\n").slice(-4000) || null;
  }
}
