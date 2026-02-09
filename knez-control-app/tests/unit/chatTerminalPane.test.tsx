import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tauri-apps/plugin-shell", () => {
  return {
    Command: {
      create: () => ({
        execute: vi.fn(async () => ({ code: 0, signal: null, stdout: "", stderr: "" })),
        spawn: vi.fn(async () => ({ pid: 1, kill: vi.fn(async () => {}) })),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      }),
    },
  };
});

describe("ChatTerminalPane", () => {
  it("renders terminal controls", async () => {
    (window as any).__TAURI__ = { invoke: () => {} };
    const { ChatTerminalPane } = await import("../../src/features/chat/ChatTerminalPane");
    render(<ChatTerminalPane />);
    expect(screen.getByRole("button", { name: "Directory" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
  });
});

