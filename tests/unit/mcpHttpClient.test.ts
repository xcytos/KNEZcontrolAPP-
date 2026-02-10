import { describe, expect, test } from "vitest";
import http from "node:http";
import { McpHttpClient } from "../../src/mcp/client/McpHttpClient";

function startMockMcpServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(Buffer.from(c));
    const body = Buffer.concat(chunks).toString("utf-8");
    const msg = JSON.parse(body);
    const id = String(msg.id);
    const method = String(msg.method);

    if (req.url === "/unauthorized") {
      res.statusCode = 401;
      res.setHeader("Content-Type", "text/plain");
      res.end("nope");
      return;
    }

    if (method === "tools/list") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id, result: { tools: [{ name: "t1", description: "d1" }] } })}\n\n`);
      res.end();
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id, result: { ok: true, method } }));
  });

  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

describe("McpHttpClient", () => {
  test("initialize over JSON response", async () => {
    const mock = await startMockMcpServer();
    try {
      const client = new McpHttpClient();
      await client.startWithConfig({ id: "github", type: "http", url: `${mock.url}/mcp`, headers: {} } as any);
      const res = await client.initialize();
      expect(res.ok).toBe(true);
      expect(res.method).toBe("initialize");
    } finally {
      await mock.close();
    }
  });

  test("tools/list over SSE", async () => {
    const mock = await startMockMcpServer();
    try {
      const client = new McpHttpClient();
      await client.startWithConfig({ id: "github", type: "http", url: `${mock.url}/mcp`, headers: {} } as any);
      await client.initialize();
      const tools = await client.listTools();
      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe("t1");
    } finally {
      await mock.close();
    }
  });

  test("rejects on http 401 without leaking body", async () => {
    const mock = await startMockMcpServer();
    try {
      const client = new McpHttpClient();
      await client.startWithConfig({ id: "github", type: "http", url: `${mock.url}/unauthorized`, headers: {} } as any);
      await expect(client.initialize()).rejects.toThrow(/mcp_http_401/);
      await expect(client.initialize()).rejects.not.toThrow(/nope/);
    } finally {
      await mock.close();
    }
  });
});

