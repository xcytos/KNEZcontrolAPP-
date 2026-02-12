import { describe, expect, it } from "vitest";
import { getMcpAuthority } from "../../src/mcp/authority";

describe("getMcpAuthority", () => {
  it("defaults to ts when not running in Tauri", () => {
    const w: any = window as any;
    delete w.__TAURI_INTERNALS__;
    delete w.__TAURI__;
    delete w.__TAURI_IPC__;
    expect(getMcpAuthority()).toBe("ts");
  });

  it("returns rust when running in Tauri and VITE_MCP_AUTHORITY=rust", () => {
    const w: any = window as any;
    w.__TAURI__ = {};
    w.__KNEZ_MCP_AUTHORITY = "rust";
    expect(getMcpAuthority()).toBe("rust");
  });
});
