import { describe, expect, test } from "vitest";
import { McpStdioClient } from "../../src/services/McpStdioClient";

function frameContentLength(bodyText: string, crlf = true): Uint8Array {
  const encoder = new TextEncoder();
  const body = encoder.encode(bodyText);
  const header = crlf
    ? encoder.encode(`Content-Length: ${body.length}\r\n\r\n`)
    : encoder.encode(`Content-Length: ${body.length}\n\n`);
  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  return out;
}

describe("McpStdioClient stdout parsing", () => {
  test("parses Content-Length framed response (CRLF)", async () => {
    const client = new McpStdioClient();
    let resolved: any = null;
    let rejected: any = null;

    (client as any).pending.set("1", {
      resolve: (v: any) => (resolved = v),
      reject: (e: any) => (rejected = e),
    });

    const msg = JSON.stringify({ jsonrpc: "2.0", id: "1", result: { ok: true } });
    (client as any).onStdout(frameContentLength(msg, true));

    expect(rejected).toBeNull();
    expect(resolved).toEqual({ ok: true });
  });

  test("parses Content-Length framed response (LF)", async () => {
    const client = new McpStdioClient();
    let resolved: any = null;
    let rejected: any = null;

    (client as any).pending.set("1", {
      resolve: (v: any) => (resolved = v),
      reject: (e: any) => (rejected = e),
    });

    const msg = JSON.stringify({ jsonrpc: "2.0", id: "1", result: { tools: [] } });
    (client as any).onStdout(frameContentLength(msg, false));

    expect(rejected).toBeNull();
    expect(resolved).toEqual({ tools: [] });
  });

  test("handles numeric id responses by matching string pending ids", async () => {
    const client = new McpStdioClient();
    let resolved: any = null;
    let rejected: any = null;

    (client as any).pending.set("1", {
      resolve: (v: any) => (resolved = v),
      reject: (e: any) => (rejected = e),
    });

    const msg = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: 1 } });
    (client as any).onStdout(frameContentLength(msg, true));

    expect(rejected).toBeNull();
    expect(resolved).toEqual({ ok: 1 });
  });

  test("parses newline-delimited json responses", async () => {
    const client = new McpStdioClient();
    let resolved: any = null;
    let rejected: any = null;

    (client as any).pending.set("1", {
      resolve: (v: any) => (resolved = v),
      reject: (e: any) => (rejected = e),
    });

    (client as any).onStdout(`{"jsonrpc":"2.0","id":"1","result":{"ok":true}}\n`);

    expect(rejected).toBeNull();
    expect(resolved).toEqual({ ok: true });
  });

  test("parses Content-Length framed response split across chunks", async () => {
    const client = new McpStdioClient();
    let resolved: any = null;
    let rejected: any = null;

    (client as any).pending.set("1", {
      resolve: (v: any) => (resolved = v),
      reject: (e: any) => (rejected = e),
    });

    const msg = JSON.stringify({ jsonrpc: "2.0", id: "1", result: { ok: true } });
    const framed = frameContentLength(msg, true);
    const a = framed.slice(0, 8);
    const b = framed.slice(8);
    (client as any).onStdout(a);
    expect(resolved).toBeNull();
    (client as any).onStdout(b);

    expect(rejected).toBeNull();
    expect(resolved).toEqual({ ok: true });
  });
});

