import { logger } from '../utils/LogService';
import { knezClient } from "../knez/KnezClient";
import { redactAny } from "../../utils/redact";
import { sessionDatabase } from "../session/SessionDatabase";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportDiagnosticsBundle(): Promise<{ location: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `knez-control-diagnostics-${timestamp}.json`;

  let health: any = null;
  let cognitive: any = null;
  try {
    health = await knezClient.health({ timeoutMs: 2500 });
  } catch {}
  try {
    cognitive = await knezClient.getCognitiveState();
  } catch {}

  const payload = redactAny({
    meta: {
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      tauri: isTauriRuntime(),
      profile: knezClient.getProfile(),
    },
    status: {
      health,
      cognitive,
    },
    logs: logger.getLogs().slice(0, 500),
  });

  const text = JSON.stringify(payload, null, 2);

  if (!isTauriRuntime()) {
    downloadText(filename, text);
    return { location: `download:${filename}` };
  }

  const { writeTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
  await writeTextFile(filename, text, { baseDir: BaseDirectory.AppLocalData });
  return { location: `AppLocalData/${filename}` };
}

export async function exportSessionBundle(sessionId: string): Promise<{ fileName: string; location: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeSid = String(sessionId || "unknown").slice(0, 12);
  const filename = `knez-session-bundle-${safeSid}-${timestamp}.json`;

  const [
    chat,
    events,
    memory,
    replay,
    summary,
    insights,
    resumeSnapshot,
    lineage,
    checkpoints
  ] = await Promise.allSettled([
    sessionDatabase.loadMessages(sessionId),
    knezClient.listEvents(sessionId, 500),
    knezClient.listMemory(sessionId, { limit: 500, order: "desc" }),
    knezClient.getReplayTimeline(sessionId),
    knezClient.getSummary(sessionId),
    knezClient.getInsights(sessionId),
    knezClient.getResumeSnapshot(sessionId),
    knezClient.getSessionLineageChain(sessionId),
    knezClient.listCheckpoints(sessionId, 500)
  ]);

  const payload = redactAny({
    meta: {
      createdAt: new Date().toISOString(),
      tauri: isTauriRuntime(),
      profile: knezClient.getProfile(),
      sessionId
    },
    session: {
      chat: chat.status === "fulfilled" ? chat.value : null,
      events: events.status === "fulfilled" ? events.value : null,
      memory: memory.status === "fulfilled" ? memory.value : null,
      replay: replay.status === "fulfilled" ? replay.value : null,
      summary: summary.status === "fulfilled" ? summary.value : null,
      insights: insights.status === "fulfilled" ? insights.value : null,
      resumeSnapshot: resumeSnapshot.status === "fulfilled" ? resumeSnapshot.value : null,
      lineage: lineage.status === "fulfilled" ? lineage.value : null,
      checkpoints: checkpoints.status === "fulfilled" ? checkpoints.value : null
    },
    logs: logger.getLogs().slice(0, 200)
  });

  const text = JSON.stringify(payload, null, 2);

  if (!isTauriRuntime()) {
    downloadText(filename, text);
    return { fileName: filename, location: `download:${filename}` };
  }

  const { writeTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
  await writeTextFile(filename, text, { baseDir: BaseDirectory.AppLocalData });
  return { fileName: filename, location: `AppLocalData/${filename}` };
}
