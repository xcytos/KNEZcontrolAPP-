import { db } from "./SessionDatabase";

export type FixAction = {
  id: string;
  label: string;
  run: () => Promise<void>;
};

export async function clearTestSessions(): Promise<void> {
  const testPrefix = "test-session-";
  const sessions = await db.sessions.toArray();
  const ids = sessions.filter(s => s.id.startsWith(testPrefix)).map(s => s.id);
  if (ids.length === 0) return;
  await db.messages.filter(m => m.sessionId.startsWith(testPrefix)).delete();
  await db.sessions.bulkDelete(ids);
}

export function getRecommendedFixes(
  testId: string,
  deps: {
    forceCheck: () => Promise<void>;
    launchAndConnect: (force?: boolean) => Promise<void>;
    clearTestSessions: () => Promise<void>;
  }
): FixAction[] {
  const fixes: FixAction[] = [];

  if (testId === "1") {
    fixes.push(
      { id: "force_check", label: "Re-check health", run: deps.forceCheck },
      { id: "force_start", label: "Force start / reconnect KNEZ", run: () => deps.launchAndConnect(true) }
    );
  }

  if (testId === "2") {
    fixes.push(
      { id: "force_check", label: "Re-check health", run: deps.forceCheck },
      { id: "force_start", label: "Force start / reconnect KNEZ", run: () => deps.launchAndConnect(true) }
    );
  }

  if (testId === "3") {
    fixes.push(
      { id: "clear_test_sessions", label: "Remove diagnostics sessions from history", run: deps.clearTestSessions }
    );
  }

  if (testId === "4") {
    fixes.push(
      { id: "force_start", label: "Force start / reconnect KNEZ", run: () => deps.launchAndConnect(true) },
      { id: "force_check", label: "Re-check health", run: deps.forceCheck }
    );
  }

  if (testId === "5" || testId === "6") {
    fixes.push(
      { id: "force_check", label: "Re-check health", run: deps.forceCheck }
    );
  }

  return fixes;
}
