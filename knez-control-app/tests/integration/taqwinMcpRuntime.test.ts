import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";

function encodeFrame(obj: any): Buffer {
  const json = JSON.stringify(obj);
  const body = Buffer.from(json, "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  return Buffer.concat([header, body]);
}

function tryParseFrames(buf: Buffer): Array<{ msg: any; rest: Buffer }> {
  const out: Array<{ msg: any; rest: Buffer }> = [];
  let b = buf;
  while (true) {
    const headerEnd = b.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const header = b.slice(0, headerEnd).toString("utf8");
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) break;
    const len = Number(m[1]);
    const bodyStart = headerEnd + 4;
    if (b.length < bodyStart + len) break;
    const body = b.slice(bodyStart, bodyStart + len).toString("utf8");
    const msg = JSON.parse(body);
    b = b.slice(bodyStart + len);
    out.push({ msg, rest: b });
  }
  return out;
}

describe("TAQWIN_V1 MCP stdio runtime (integration)", () => {
  it(
    "initializes, lists tools, calls debug_test, then rejects after process kill",
    async () => {
      const serverPath = "C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\TAQWIN_V1\\core\\mcp_server.py";

      const proc = spawn("python", ["-u", serverPath], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          TAQWIN_MCP_OUTPUT_MODE: "content-length",
        },
      });

      let stdoutBuf = Buffer.alloc(0);
      const pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
      let exited: { code: number | null; signal: NodeJS.Signals | null } | null = null;

      const flush = () => {
        const parsed = tryParseFrames(stdoutBuf);
        if (parsed.length === 0) return;
        stdoutBuf = parsed[parsed.length - 1].rest;
        for (const { msg } of parsed) {
          const id = msg?.id !== undefined ? String(msg.id) : null;
          if (id && pending.has(id)) {
            const p = pending.get(id)!;
            pending.delete(id);
            if (msg.error) p.reject(new Error(`mcp_error_${msg.error.code}:${msg.error.message}`));
            else p.resolve(msg);
          }
        }
      };

      proc.stdout.on("data", (d) => {
        stdoutBuf = Buffer.concat([stdoutBuf, Buffer.isBuffer(d) ? d : Buffer.from(d)]);
        flush();
      });
      proc.on("exit", (code, signal) => {
        exited = { code, signal };
        for (const [, p] of pending) {
          p.reject(new Error("mcp_process_crashed"));
        }
        pending.clear();
      });

      const send = async (msg: any) => {
        if (exited) throw new Error("mcp_process_crashed");
        const id = String(msg.id);
        const p = new Promise<any>((resolve, reject) => pending.set(id, { resolve, reject }));
        proc.stdin.write(encodeFrame(msg));
        return await p;
      };

      const init = await send({ jsonrpc: "2.0", id: "1", method: "initialize", params: {} });
      expect(init.result).toBeTruthy();

      const list = await send({ jsonrpc: "2.0", id: "2", method: "tools/list", params: {} });
      const tools = list?.result?.tools ?? list?.result ?? [];
      const toolNames = Array.isArray(tools) ? tools.map((t: any) => String(t?.name ?? "")) : [];
      expect(toolNames).toContain("debug_test");

      const call = await send({
        jsonrpc: "2.0",
        id: "3",
        method: "tools/call",
        params: { name: "debug_test", arguments: { message: "ping", include_env: false } },
      });
      expect(call.result).toBeTruthy();

      proc.kill();

      await expect(
        send({ jsonrpc: "2.0", id: "4", method: "tools/call", params: { name: "debug_test", arguments: { message: "after_kill" } } })
      ).rejects.toThrow(/mcp_process_crashed/);
    },
    { timeout: 20000 }
  );
});

