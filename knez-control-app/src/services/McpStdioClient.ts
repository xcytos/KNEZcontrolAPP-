import { Command, Child } from "@tauri-apps/plugin-shell";
import { McpToolDefinition } from "./McpTypes";

type McpRequest = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: any;
};

type McpResponse =
  | { jsonrpc: "2.0"; id: string; result: any }
  | { jsonrpc: "2.0"; id: string; error: { code: number; message: string; data?: any } };

export class McpStdioClient {
  private child: Child | null = null;
  private buffer = "";
  private nextId = 1;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();

  async start(programName: string): Promise<void> {
    if (this.child) return;
    const cmd = Command.create(programName);
    cmd.stdout.on("data", (chunk) => this.onStdout(String(chunk)));
    cmd.stderr.on("data", (chunk) => this.onStderr(String(chunk)));
    cmd.on("close", (evt) => {
      const err = new Error(`mcp_process_closed_${evt.code ?? "null"}`);
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      this.child = null;
    });
    cmd.on("error", (err) => {
      const e = this.asMcpError(err);
      for (const p of this.pending.values()) p.reject(e);
      this.pending.clear();
    });
    try {
      this.child = await cmd.spawn();
    } catch (err) {
      const e = this.asMcpError(err);
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    await this.child.kill();
    this.child = null;
  }

  private onStdout(chunk: string) {
    this.buffer += chunk;
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const headerBlock = this.buffer.slice(0, headerEnd);
      const m = headerBlock.match(/content-length:\s*(\d+)/i);
      if (!m) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + len;
      if (this.buffer.length < bodyEnd) return;
      const body = this.buffer.slice(bodyStart, bodyEnd);
      this.buffer = this.buffer.slice(bodyEnd);
      try {
        const parsed = JSON.parse(body) as McpResponse;
        this.onMessage(parsed);
      } catch {
        continue;
      }
    }
  }

  private onStderr(_chunk: string) {}

  private onMessage(msg: McpResponse) {
    const slot = this.pending.get(msg.id);
    if (!slot) return;
    this.pending.delete(msg.id);
    if ("error" in msg) {
      slot.reject(new Error(msg.error.message));
    } else {
      slot.resolve(msg.result);
    }
  }

  private asMcpError(err: any): Error {
    const msg = String(err?.message ?? err);
    if (/stdin[_-]?write.*not allowed/i.test(msg) || /allow-stdin-write/i.test(msg)) {
      return new Error(`mcp_stdin_write_denied: ${msg}`);
    }
    return new Error(msg);
  }

  private async request<T = any>(method: string, params?: any): Promise<T> {
    if (!this.child) throw new Error("mcp_not_started");
    const id = String(this.nextId++);
    const req: McpRequest = { jsonrpc: "2.0", id, method, params };
    const body = JSON.stringify(req);
    const header = `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n`;
    const payload = header + body;
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    try {
      await this.child.write(payload);
    } catch (err) {
      const slot = this.pending.get(id);
      if (slot) {
        this.pending.delete(id);
        slot.reject(this.asMcpError(err));
      }
    }
    return p;
  }

  async initialize(): Promise<any> {
    return await this.request("initialize", {});
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const res = await this.request<{ tools?: McpToolDefinition[] }>("tools/list", {});
    return Array.isArray(res?.tools) ? res.tools : [];
  }

  async callTool(name: string, args: any): Promise<any> {
    return await this.request("tools/call", { name, arguments: args ?? {} });
  }
}
