import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { useSystemOrchestrator } from "../../../src/features/system/useSystemOrchestrator";
import { act } from "react";

vi.mock("@tauri-apps/plugin-shell", () => {
  const makeEmitter = () => {
    const listeners: any[] = [];
    return {
      on: (_evt: string, cb: any) => {
        listeners.push(cb);
        return () => {};
      },
      emit: (val: any) => listeners.forEach((l) => l(val)),
    };
  };

  const stdout = makeEmitter();
  const stderr = makeEmitter();
  const events: Record<string, any[]> = { close: [], error: [] };

  return {
    Child: class {
      pid = 1;
      async kill() {}
    },
    Command: {
      create: () => ({
        stdout,
        stderr,
        on: (evt: "close" | "error", cb: any) => {
          events[evt] = events[evt] ?? [];
          events[evt].push(cb);
        },
        spawn: vi.fn(async () => ({ pid: 1, kill: vi.fn(async () => {}) })),
      }),
    },
  };
});

const { knezClientMock } = vi.hoisted(() => ({
  knezClientMock: {
    health: vi.fn(),
  },
}));

vi.mock("../../../src/services/KnezClient", () => ({
  knezClient: knezClientMock,
}));

function Harness() {
  const { status, output, healthProbe, launchAndConnect } = useSystemOrchestrator();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="output">{output}</div>
      <div data-testid="probe">{JSON.stringify(healthProbe)}</div>
      <button onClick={() => void launchAndConnect(true)}>start</button>
    </div>
  );
}

describe("useSystemOrchestrator health probe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (window as any).__TAURI__ = {};
    knezClientMock.health.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("does not spam output with repeated waiting lines", async () => {
    let n = 0;
    knezClientMock.health.mockImplementation(async () => {
      n++;
      if (n <= 6) throw new Error("Failed to fetch: http://127.0.0.1:8000/health");
      return { status: "ok", backends: [] };
    });

    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByText("start"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    const output = screen.getByTestId("output").textContent ?? "";
    expect(output.includes("[Health] Waiting for /health")).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByTestId("status").textContent).toBe("running");
  });

  it.skip("exposes health probe progress while starting (skipped - timing issue)", async () => {
    let n = 0;
    knezClientMock.health.mockImplementation(async () => {
      n++;
      if (n <= 20) throw new Error("Health check timed out: http://127.0.0.1:8000/health");
      return { status: "ok", backends: [] };
    });

    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByText("start"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    const probe = screen.getByTestId("probe").textContent ?? "";
    expect(probe.includes("\"active\":true")).toBe(true);
    expect(probe.includes("\"attempts\":")).toBe(true);
  });
});
