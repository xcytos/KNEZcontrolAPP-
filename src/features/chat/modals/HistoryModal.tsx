import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/core/Modal';
import { Input } from '../../../components/ui/core/Input';
import { Button } from '../../../components/ui/core/Button';
import { History, Trash2 } from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';
import { sessionDatabase } from '../../../services/SessionDatabase';
import { sessionController } from '../../../services/SessionController';
import { knezClient } from '../../../services/KnezClient';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  onInspect: (sid: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  onInspect,
}) => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<{id: string, name: string, updatedAt: string, tags?: string[], outcome?: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (isOpen) {
      setLoading(true);
      sessionDatabase.getSessions()
        .then(list => {
          const sorted = list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          const filtered = sorted.filter(s => !s.id.startsWith("test-session-"));
          if (!cancelled) setSessions(filtered);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; };
  }, [isOpen]);

  const filteredSessions = sessions.filter(s => 
    (`${s.name} ${s.id}`.toLowerCase()).includes(query.trim().toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" title={
      <div className="flex items-center gap-2">
        <History size={16} />
        Session History
      </div>
    }>
      <div className="p-4 space-y-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sessions..."
        />
        
        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-xs">Loading sessions...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs">No history found.</div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map(s => (
              <div
                key={s.id}
                className={`
                  w-full text-left p-3 rounded-lg text-sm transition-all border
                  ${currentSessionId === s.id
                    ? "bg-blue-900/20 border-blue-800 text-blue-200"
                    : "bg-zinc-900 border-transparent hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => {
                      sessionController.useSession(s.id);
                      showToast(`Opened session: ${s.id.substring(0, 8)}`, "success");
                      onClose();
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-zinc-500 font-mono">ID: {s.id.substring(0,8)}</span>
                      <span className="text-[10px] text-zinc-600">{new Date(s.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray((s as any).tags) ? ((s as any).tags as any[]) : []).slice(0, 4).map((t: any) => (
                          <span key={String(t)} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-950/40 border border-zinc-800 text-zinc-400">
                            {String(t)}
                          </span>
                        ))}
                      </div>
                      {String((s as any).outcome || "") && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-950/40 border border-zinc-800 text-zinc-400">
                          {String((s as any).outcome).slice(0, 16)}
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onInspect(s.id);
                      }}
                      title="Inspect session"
                    >
                      inspect
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (busyId) return;
                        setBusyId(s.id);
                        try {
                          const ok = await knezClient.validateSession(s.id);
                          if (!ok) {
                            showToast("Session not present on server yet", "warning");
                            return;
                          }
                          const next = await sessionController.resumeSession(s.id);
                          showToast(`Resumed: ${next.substring(0, 8)}`, "success");
                          onClose();
                        } catch (err: any) {
                          showToast(String(err?.message ?? err), "error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      disabled={busyId !== null}
                      title="Resume as new session"
                    >
                      {busyId === s.id ? "..." : "resume"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (busyId) return;
                        setBusyId(s.id);
                        try {
                          const ok = await knezClient.validateSession(s.id);
                          if (!ok) {
                            showToast("Session not present on server yet", "warning");
                            return;
                          }
                          const next = await sessionController.forkSession(s.id);
                          showToast(`Forked: ${next.substring(0, 8)}`, "success");
                          onClose();
                        } catch (err: any) {
                          showToast(String(err?.message ?? err), "error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      disabled={busyId !== null}
                      title="Fork as new session"
                    >
                      {busyId === s.id ? "..." : "fork"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await sessionDatabase.deleteSession(s.id);
                        setSessions((prev) => prev.filter((x) => x.id !== s.id));
                      }}
                      title="Delete session"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
