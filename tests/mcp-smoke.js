import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function encodeRequest(id, method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  const len = new TextEncoder().encode(body).length;
  return `Content-Length: ${len}\r\n\r\n${body}`;
}

function createStdoutParser(onMessage) {
  let buffer = "";
  return (chunk) => {
    buffer += chunk;
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd >= 0) {
        const headerBlock = buffer.slice(0, headerEnd);
        const m = headerBlock.match(/content-length:\s*(\d+)/i);
        if (!m) {
          buffer = buffer.slice(headerEnd + 4);
          continue;
        }
        const len = Number(m[1]);
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + len;
        if (buffer.length < bodyEnd) return;
        const body = buffer.slice(bodyStart, bodyEnd);
        buffer = buffer.slice(bodyEnd);
        try {
          onMessage(JSON.parse(body));
        } catch {}
        continue;
      }

      const lineEnd = buffer.indexOf("\n");
      if (lineEnd < 0) return;
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (!line) continue;
      if (!line.startsWith("{") && !line.startsWith("[")) continue;
      try {
        onMessage(JSON.parse(line));
      } catch {}
    }
  };
}

function withTimeout(promise, timeoutMs, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label}_timeout_${timeoutMs}`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function main() {
  const taqwinDir = path.resolve(__dirname, "..", "..", "TAQWIN_V1");
  const child = spawn("python", ["main.py"], {
    cwd: taqwinDir,
    env: {
      ...process.env,
      TAQWIN_LOG_LEVEL: "INFO",
      PYTHONUNBUFFERED: "1",
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: false,
  });

  const pending = new Map();
  const onStdout = createStdoutParser((msg) => {
    const slot = pending.get(String(msg?.id ?? ""));
    if (!slot) return;
    pending.delete(String(msg?.id ?? ""));
    if (msg?.error) slot.reject(new Error(String(msg.error.message ?? "mcp_error")));
    else slot.resolve(msg?.result);
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", onStdout);
  child.stderr.on("data", (d) => process.stderr.write(String(d)));

  const request = async (method, params, timeoutMs) => {
    const id = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    const payload = encodeRequest(id, method, params);
    const p = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    child.stdin.write(payload);
    return await withTimeout(p, timeoutMs, method.replaceAll("/", "_"));
  };

  try {
    await request("initialize", {}, 90000);
    const toolsRes = await request("tools/list", {}, 60000);
    const tools = Array.isArray(toolsRes?.tools) ? toolsRes.tools : [];
    process.stdout.write(`tools=${tools.length}\n`);
    process.stdout.write(`first=${tools.slice(0, 5).map((t) => t?.name).join(",")}\n`);
    process.exitCode = tools.length > 0 ? 0 : 2;
  } finally {
    try { child.kill(); } catch {}
  }
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + "\n");
  process.exitCode = 1;
});
