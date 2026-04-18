import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../../src/services/PersistenceService", () => ({
  persistenceService: {
    listSessions: vi.fn(async () => ["sid1"]),
  },
}));

vi.mock("../../../src/services/SessionController", () => ({
  sessionController: {
    useSession: vi.fn(),
  },
}));

vi.mock("../../../src/services/KnezClient", () => ({
  knezClient: {
    getInsights: vi.fn(async () => {
      throw new Error("Failed to fetch");
    }),
    getSummary: vi.fn(async () => ({})),
  },
}));

describe("ReflectionPane analysis flow", () => {
  it("shows actionable error when KNEZ is unreachable", async () => {
    const { ReflectionPane } = await import("../../../src/features/reflection/ReflectionPane");
    render(<ReflectionPane sessionId="sid1" readOnly={false} />);

    const analyzeBtn = await screen.findByText("Analyze Session");
    fireEvent.click(analyzeBtn);

    expect(await screen.findByText("KNEZ is unreachable. Start KNEZ and retry.")).toBeTruthy();
  });
});

