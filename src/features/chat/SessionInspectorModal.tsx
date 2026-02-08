import React, { useEffect, useState } from "react";
import { knezClient } from "../../services/KnezClient";
import { sessionDatabase } from "../../services/SessionDatabase";
import { useToast } from "../../components/ui/Toast";
import { exportSessionBundle } from "../../services/DiagnosticsService";
import { sessionController } from "../../services/SessionController";

export const SessionInspectorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}> = ({ isOpen, onClose, sessionId }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [outcome, setOutcome] = useState("");
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [lineage, setLineage] = useState<any | null>(null);
  const [checkpoints, setCheckpoints] = useState<any[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      sessionDatabase.getSession(sessionId),
      knezClient.getResumeSnapshot(sessionId),
      knezClient.getSessionLineageChain(sessionId),
      knezClient.listCheckpoints(sessionId, 200),
    ])
      .then(([s, snap, lin, cps]) => {
        if (cancelled) return;
        const sess = s.status === "fulfilled" ? s.value : undefined;
        setSessionName(sess?.name ?? `Session ${sessionId.slice(0, 6)}`);
        setTagsText(Array.isArray((sess as any)?.tags) ? ((sess as any).tags as string[]).join(", ") : "");
        setOutcome(typeof (sess as any)?.outcome === "string" ? (sess as any).outcome : "");
        setSnapshot(snap.status === "fulfilled" ? snap.value : null);
        setLineage(lin.status === "fulfilled" ? lin.value : null);
        setCheckpoints(cps.status === "fulfilled" ? (cps.value?.items ?? []) : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, sessionId]);

  if (!isOpen) return null;
  if (!sessionId) return null;

  const saveMeta = async () => {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
    await sessionDatabase.updateSessionTags(sessionId, tags);
    await sessionDatabase.updateSessionOutcome(sessionId, outcome.trim().slice(0, 32));
    showToast("Session metadata saved", "success");
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[920px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div>
            <div className="text-sm font-bold text-white">Session Inspector</div>
            <div className="text-[10px] text-zinc-500 font-mono">{sessionId}</div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Loading session data...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950/40 border border-zinc-800 rounded p-3">
                  <div className="text-[10px] uppercase text-zinc-500 mb-2">Metadata</div>
                  <div className="text-xs text-zinc-300 mb-2">name: {sessionName}</div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] text-zinc-500 mb-1">tags (comma separated)</div>
                      <input
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-700"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 mb-1">outcome</div>
                      <input
                        value={outcome}
                        onChange={(e) => setOutcome(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-700"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void saveMeta()}
                        className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "chat" } }))}
                        className="text-xs px-3 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      >
                        Chat
                      </button>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "reflection" } }))}
                        className="text-xs px-3 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      >
                        Analyze
                      </button>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "replay" } }))}
                        className="text-xs px-3 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      >
                        Replay
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await exportSessionBundle(sessionId);
                            showToast(`Exported session bundle: ${res.fileName}`, "success");
                          } catch (e: any) {
                            showToast(String(e?.message ?? e), "error");
                          }
                        }}
                        className="text-xs px-3 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      >
                        Export Bundle
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-950/40 border border-zinc-800 rounded p-3">
                  <div className="text-[10px] uppercase text-zinc-500 mb-2">Lineage</div>
                  {Array.isArray(lineage?.chain) && lineage.chain.length > 0 ? (
                    <div className="space-y-2">
                      {lineage.chain.map((c: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <button
                            onClick={() => {
                              const sid = String(c.session_id ?? "");
                              if (!sid) return;
                              sessionController.useSession(sid);
                            }}
                            className="font-mono text-zinc-200 hover:text-blue-300"
                          >
                            {String(c.session_id ?? "").slice(0, 8)}…
                          </button>
                          <span className="text-[10px] text-zinc-500">{String(c.resume_mode ?? "fresh")}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500">No lineage chain.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950/40 border border-zinc-800 rounded p-3">
                  <div className="text-[10px] uppercase text-zinc-500 mb-2">Resume Snapshot</div>
                  {snapshot ? (
                    <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap">{JSON.stringify(snapshot, null, 2)}</pre>
                  ) : (
                    <div className="text-xs text-zinc-500">No snapshot available.</div>
                  )}
                </div>

                <div className="bg-zinc-950/40 border border-zinc-800 rounded p-3">
                  <div className="text-[10px] uppercase text-zinc-500 mb-2">Checkpoints</div>
                  {Array.isArray(checkpoints) && checkpoints.length > 0 ? (
                    <div className="space-y-1">
                      {checkpoints.slice(0, 200).map((c: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] font-mono text-zinc-300">
                          <span>t={String(c.token_index)}</span>
                          <span className="text-zinc-500">{String(c.sha ?? "").slice(0, 10)}…</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500">No checkpoints found.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
