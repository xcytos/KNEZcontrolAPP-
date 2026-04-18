import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let mockMcpStatus: any = {
  state: "READY",
  processAlive: true,
  initialized: true,
  trust: "trusted",
  framing: "line",
  lastStartAt: null,
  lastOkAt: null,
  consecutiveFailures: 0,
  lastRawError: null,
  lastNormalizedError: null,
  lastError: null,
  debug: null,
};

vi.mock("@tauri-apps/plugin-shell", () => {
  return {
    Command: {
      create: () => ({
        execute: vi.fn(async () => ({ code: 0, signal: null, stdout: "", stderr: "" })),
        spawn: vi.fn(async () => {}),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      }),
    },
  };
});

vi.mock("../../../src/hooks/useTaqwinMcpStatus", () => ({
  useTaqwinMcpStatus: () => mockMcpStatus,
}));

vi.mock("../../../src/mcp/taqwin/TaqwinMcpService", () => ({
  taqwinMcpService: {
    listTools: vi.fn(async () => []),
    start: vi.fn(async () => mockMcpStatus),
    stop: vi.fn(async () => {}),
    selfTest: vi.fn(async () => ({ ok: true, steps: [] })),
    getStatus: () => mockMcpStatus,
  },
}));

vi.mock("../../../src/mcp/config/McpHostConfigService", () => ({
  mcpHostConfigService: {
    load: vi.fn(async () => null),
    getDefault: vi.fn(async () => ({ raw: "{}", config: { servers: {} } })),
    save: vi.fn(async () => ({ config: { servers: {} }, issues: {} })),
  },
}));

vi.mock("../../../src/services/ChatService", () => ({
  chatService: {
    load: vi.fn(async () => {}),
  },
}));

vi.mock("../../../src/services/SessionDatabase", () => ({
  sessionDatabase: {
    saveMessages: vi.fn(async () => {}),
  },
}));

vi.mock("../../../src/services/SessionController", () => ({
  sessionController: {
    getSessionId: () => "deadbeefdeadbeef",
  },
}));

vi.mock("../../../src/services/KnezClient", () => ({
  knezClient: {
    getProfile: () => ({ trustLevel: "trusted", endpoint: "http://localhost:8000" }),
  },
}));

vi.mock("../../../src/services/LogService", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    getLogs: () => [],
  },
}));

describe("TaqwinToolsModal status rendering", () => {
  beforeEach(() => {
    (window as any).__TAURI__ = { invoke: () => {} };
  });

  it("renders running status and restart label", async () => {
    mockMcpStatus = { ...mockMcpStatus, state: "READY", trust: "trusted" };
    const { TaqwinToolsModal } = await import("../../../src/features/chat/TaqwinToolsModal");
    render(<TaqwinToolsModal isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText(/mcp_state=\s*READY/)).toBeTruthy();
    expect(screen.getByTestId("mcp-control")).toBeTruthy();
    expect(screen.getByTestId("mcp-control").textContent || "").toContain("Restart TAQWIN MCP");
  });

  it("renders down status and start label", async () => {
    mockMcpStatus = { ...mockMcpStatus, state: "IDLE", processAlive: false, initialized: false, trust: "untrusted" };
    const { TaqwinToolsModal } = await import("../../../src/features/chat/TaqwinToolsModal");
    render(<TaqwinToolsModal isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText(/mcp_state=\s*IDLE/)).toBeTruthy();
    expect(screen.getByTestId("mcp-control")).toBeTruthy();
    expect(screen.getByTestId("mcp-control").textContent || "").toContain("Start TAQWIN MCP");
  });
});
