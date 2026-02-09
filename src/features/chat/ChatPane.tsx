import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage } from "../../domain/DataContracts";
import { knezClient } from "../../services/KnezClient";
import { MessageItem } from "./MessageItem";
// import { exportChat } from "./ChatUtils";
import { useToast } from "../../components/ui/Toast";
// import { PerceptionPanel } from "../perception/PerceptionPanel";
import { VoiceInput } from "../voice/VoiceInput";
// import { observe } from "../../utils/observer";
import { chatService } from "../../services/ChatService";
import { sessionDatabase } from "../../services/SessionDatabase";
import { sessionController } from "../../services/SessionController";
import { FolderOpen, History, Loader2, MessageSquarePlus, MoreVertical, Play, Search, Square, TerminalSquare, Trash2, Puzzle, Sparkles, Zap } from "lucide-react";
import { TaqwinToolsModal } from "./TaqwinToolsModal";
import { SessionInspectorModal } from "./SessionInspectorModal";
import { useStatus } from "../../contexts/useStatus";
import { backendHasLiveMetrics, isBackendHealthyStatus, selectPrimaryBackend } from "../../utils/health";
import { features } from "../../config/features";
import { useTaqwinActivationStatus } from "../../hooks/useTaqwinActivationStatus";
import { useTaqwinMcpStatus } from "../../hooks/useTaqwinMcpStatus";
import { ChatTerminalPane } from "./ChatTerminalPane";
import { Command, Child } from "@tauri-apps/plugin-shell";

// CP17: History Modal
const HistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  onInspect: (sid: string) => void;
}> = ({ isOpen, onClose, currentSessionId, onInspect }) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History size={16} />
            Session History
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-200 outline-none focus:border-blue-700"
            />
          </div>
          {loading ? (
             <div className="p-8 text-center text-zinc-500 text-xs">Loading sessions...</div>
          ) : sessions.filter(s => (`${s.name} ${s.id}`.toLowerCase()).includes(query.trim().toLowerCase())).length === 0 ? (
             <div className="p-8 text-center text-zinc-500 text-xs">No history found.</div>
          ) : (
            sessions
              .filter(s => (`${s.name} ${s.id}`.toLowerCase()).includes(query.trim().toLowerCase()))
              .map(s => (
              <div
                key={s.id}
                className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                  currentSessionId === s.id
                    ? "bg-blue-900/20 border-blue-800 text-blue-200"
                    : "bg-zinc-900 border-transparent hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300"
                }`}
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
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onInspect(s.id);
                      }}
                      className="px-2 py-1 rounded bg-zinc-950/40 border border-zinc-800 hover:bg-zinc-950/70 text-zinc-400 hover:text-zinc-200 transition-colors text-[10px] font-mono"
                      title="Inspect session"
                    >
                      inspect
                    </button>
                    <button
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
                      className="px-2 py-1 rounded bg-zinc-950/40 border border-zinc-800 hover:bg-zinc-950/70 text-zinc-400 hover:text-zinc-200 transition-colors text-[10px] font-mono disabled:opacity-50"
                      title="Resume as new session"
                    >
                      {busyId === s.id ? "..." : "resume"}
                    </button>
                    <button
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
                      className="px-2 py-1 rounded bg-zinc-950/40 border border-zinc-800 hover:bg-zinc-950/70 text-zinc-400 hover:text-zinc-200 transition-colors text-[10px] font-mono disabled:opacity-50"
                      title="Fork as new session"
                    >
                      {busyId === s.id ? "..." : "fork"}
                    </button>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      await sessionDatabase.deleteSession(s.id);
                      setSessions((prev) => prev.filter((x) => x.id !== s.id));
                    }}
                    className="p-2 rounded bg-zinc-950/40 border border-zinc-800 hover:bg-zinc-950/70 text-zinc-400 hover:text-red-300 transition-colors"
                    title="Delete session"
                  >
                    <Trash2 size={14} />
                  </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};


// CP4-B: Forking Support
const ForkModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
}> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg max-w-sm w-full">
        <h3 className="text-lg font-bold text-white mb-2">Fork Session</h3>
        <p className="text-sm text-zinc-400 mb-6">
          Create a new session branching from this point? The current session history will be preserved.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded">
            Fork Session
          </button>
        </div>
      </div>
    </div>
  );
};

// CP15: Rename Modal
const RenameModal: React.FC<{
   isOpen: boolean;
   initialName: string;
   onClose: () => void;
   onSave: (name: string) => void;
}> = ({ isOpen, initialName, onClose, onSave }) => {
   const [name, setName] = useState(initialName);
   if (!isOpen) return null;
   return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
         <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-4">Rename Session</h3>
            <input 
               autoFocus
               className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white mb-4"
               value={name}
               onChange={e => setName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
               <button onClick={onClose} className="px-3 py-1 text-zinc-400">Cancel</button>
               <button onClick={() => onSave(name)} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
            </div>
         </div>
      </div>
   );
};

const AuditModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  messages: ChatMessage[];
}> = ({ isOpen, onClose, sessionId, messages }) => {
  const [queueCount, setQueueCount] = useState(0);
  const [inFlightCount, setInFlightCount] = useState(0);
  const [failedQueueCount, setFailedQueueCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const tick = async () => {
      if (!sessionId) return;
      const all = await sessionDatabase.listOutgoing();
      const scoped = all.filter((x) => x.sessionId === sessionId);
      if (cancelled) return;
      setQueueCount(scoped.length);
      setInFlightCount(scoped.filter((x) => x.status === "in_flight").length);
      setFailedQueueCount(scoped.filter((x) => x.status === "failed").length);
    };
    void tick();
    const t = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const queuedMessages = messages.filter((m) => m.deliveryStatus === "queued").length;
  const pendingMessages = messages.filter((m) => m.deliveryStatus === "pending").length;
  const failedMessages = messages.filter((m) => m.deliveryStatus === "failed").length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-[640px] shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-6 pb-4 flex-none border-b border-zinc-800/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-light text-zinc-200">Chat State Audit</h2>
            <button onClick={onClose} className="text-xs text-zinc-400 hover:text-white">Close</button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
            <div className="font-mono text-zinc-500 mb-2">Active Session</div>
            <div className="font-mono text-zinc-200">{sessionId ?? "none"}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
              <div className="font-mono text-zinc-500 mb-2">Messages</div>
              <div className="flex justify-between"><span className="text-zinc-500">queued</span><span className="font-mono text-zinc-200">{queuedMessages}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">pending</span><span className="font-mono text-zinc-200">{pendingMessages}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">failed</span><span className="font-mono text-zinc-200">{failedMessages}</span></div>
            </div>
            <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40">
              <div className="font-mono text-zinc-500 mb-2">Outgoing Queue</div>
              <div className="flex justify-between"><span className="text-zinc-500">total</span><span className="font-mono text-zinc-200">{queueCount}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">in_flight</span><span className="font-mono text-zinc-200">{inFlightCount}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">failed</span><span className="font-mono text-zinc-200">{failedQueueCount}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type Props = {
  sessionId: string | null;
  readOnly: boolean;
  systemStatus?: "idle" | "starting" | "running" | "failed" | "degraded";
};

export const ChatPane: React.FC<Props> = ({ sessionId, readOnly, systemStatus }) => {
  // const [showPerception, setShowPerception] = useState(false);
  // Use ChatService state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [activeTools, setActiveTools] = useState<{ search: boolean }>({ search: false });
  const [searchProvider, setSearchProvider] = useState<"off" | "taqwin" | "proxy">("off");
  
  const [inputValue, setInputValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [forkingMsgId, setForkingMsgId] = useState<string | null>(null);
  
  // CP15
  const [sessionName, setSessionName] = useState<string>("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [inspectSessionId, setInspectSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<"chat" | "terminal">("chat");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<"chat" | "terminal">("chat");
  const [terminalCwd, setTerminalCwd] = useState<string>("");
  const [terminalCmd, setTerminalCmd] = useState<string>("Get-Location");
  const [terminalOut, setTerminalOut] = useState<string>("");
  const [terminalRunning, setTerminalRunning] = useState(false);
  const termChildRef = useRef<Child | null>(null);
  const termOutRef = useRef<HTMLDivElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { online, health } = useStatus();
  const taqwinActivation = useTaqwinActivationStatus();
  const taqwinMcpStatus = useTaqwinMcpStatus();
  const backend = selectPrimaryBackend(health?.backends);
  const backendLabel = backend
    ? isBackendHealthyStatus(backend.status)
      ? backendHasLiveMetrics(backend)
        ? "healthy"
        : "stale"
      : String(backend.status ?? "down")
    : "status:n/a";
  const lastAssistant = [...messages].reverse().find((m) => m.from === "knez");
  const canContinue = !readOnly && !sending && (lastAssistant?.metrics as any)?.finishReason === "stopped";
  const [visibleCount, setVisibleCount] = useState(50);
  
  // Reset visible count when session changes
  useEffect(() => {
    setVisibleCount(50);
  }, [sessionId]);

  const hiddenCount = Math.max(0, messages.length - visibleCount);
  const visibleMessages = messages.slice(-visibleCount);

  useEffect(() => {
    if (!features.taqwinTools) return;
    const onOpen = () => setToolsOpen(true);
    window.addEventListener("taqwin-tools-open", onOpen as any);
    return () => window.removeEventListener("taqwin-tools-open", onOpen as any);
  }, []);

  useEffect(() => {
    const onFocus = (e: any) => {
      const id = String(e?.detail?.messageId ?? "");
      if (!id) return;
      window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "chat" } }));
      window.setTimeout(() => {
        const el = document.querySelector(`[data-message-id="${CSS.escape(id)}"]`) as HTMLElement | null;
        if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 50);
    };
    window.addEventListener("chat-focus-message", onFocus as any);
    return () => window.removeEventListener("chat-focus-message", onFocus as any);
  }, []);

  // Accessibility: Escape to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (historyOpen) setHistoryOpen(false);
        else if (auditOpen) setAuditOpen(false);
        else if (toolsOpen) setToolsOpen(false);
        else if (renameOpen) setRenameOpen(false);
        else if (headerMenuOpen) setHeaderMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyOpen, auditOpen, toolsOpen, renameOpen, headerMenuOpen]);

  // Sync with Service
  useEffect(() => {
    const unsub = chatService.subscribe((state) => {
       setMessages(state.messages);
       setSending(state.sending);
       setActiveTools(state.activeTools);
       setSearchProvider(state.searchProvider);
    });
    return unsub;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    sessionDatabase.getSession(sessionId).then(s => {
      if (s) setSessionName(s.name);
      else setSessionName(`Session ${sessionId.substring(0,6)}`);
    });
  }, [sessionId]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    if (editingMessageId) {
      void chatService.editUserMessageAndResend(editingMessageId, inputValue);
      setEditingMessageId(null);
    } else {
      const raw = inputValue.trim();
      const isTerminalDirective = raw.startsWith("!term ") || raw === "!term" || raw.startsWith("!cd ") || raw === "!cd";
      if (isTerminalDirective) {
        const body = raw.startsWith("!term") ? raw.replace(/^!term\s*/i, "") : raw.replace(/^!cd\s*/i, "cd ");
        if (!isTauri) {
          void chatService.sendMessage(`[SYSTEM: Terminal]\nThis requires the desktop app (Tauri).\n\nCommand: ${body || "(empty)"}`);
        } else if (!body.trim()) {
          void chatService.sendMessage(`[SYSTEM: Terminal]\nNo command provided. Try: !term Get-Location`);
        } else {
          const chunks = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          let cwd = terminalCwd;
          let out = "";
          for (const cmd of chunks.slice(0, 6)) {
            const m = cmd.match(/^cd\s+(.+)$/i) || cmd.match(/^set-location\s+(.+)$/i);
            if (m) {
              const p = String(m[1]).trim().replace(/^["']|["']$/g, "");
              if (p) {
                cwd = p;
                setTerminalCwd(p);
                appendTerm(`[CWD] ${p}`);
                out += `\n$ cd ${p}\n(exit=0)\n`;
              }
              continue;
            }
            try {
              appendTerm(`[RUN] ${cmd}`);
              const res = await Command.create(
                "powershell",
                ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
                { encoding: "utf-8", cwd: cwd || undefined }
              ).execute();
              const code = (res as any)?.code ?? null;
              const stdout = String((res as any)?.stdout ?? "").trimEnd();
              const stderr = String((res as any)?.stderr ?? "").trimEnd();
              const clippedStdout = stdout.length > 6000 ? stdout.slice(0, 6000) + "\n...(truncated)" : stdout;
              const clippedStderr = stderr.length > 2000 ? stderr.slice(0, 2000) + "\n...(truncated)" : stderr;
              if (clippedStdout) appendTerm(clippedStdout);
              if (clippedStderr) appendTerm(`[STDERR] ${clippedStderr}`);
              appendTerm(`[EXIT] code=${code ?? "null"}`);
              out += `\n$ ${cmd}\n(exit=${code ?? "null"})\n`;
              if (clippedStdout) out += `${clippedStdout}\n`;
              if (clippedStderr) out += `[STDERR]\n${clippedStderr}\n`;
            } catch (err: any) {
              const msg = String(err?.message ?? err);
              appendTerm(`[ERROR] ${msg}`);
              out += `\n$ ${cmd}\n(error)\n${msg}\n`;
            }
          }
          setComposerMode("terminal");
          const payload = `[SYSTEM: Terminal Output]\n${out.trim()}`;
          void chatService.sendMessage(payload);
        }
      } else {
        void chatService.sendMessage(inputValue);
      }
    }
    
    // UI clears immediately, service handles logic
    setInputValue("");
    setIsAtBottom(true);
    setValidating(true);
    setTimeout(() => setValidating(false), 2000);
  };

  const handleEdit = (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (msg) {
      setEditingMessageId(id);
      setInputValue(msg.text);
      if (containerRef.current) {
        // Focus logic could go here
      }
    }
  };

  const handleStop = (id: string) => {
    chatService.stopByAssistantMessageId(id);
  };

  const handleRetry = (id: string) => {
    void chatService.retryByAssistantMessageId(id);
  };

  
  const handleRename = async (newName: string) => {
     if (sessionId) {
        await sessionDatabase.updateSessionName(sessionId, newName);
        setSessionName(newName);
        setRenameOpen(false);
     }
  };

  const handleFork = async () => {
    if (!sessionId || !forkingMsgId) return;
    try {
      const newSessionId = await sessionController.forkSession(sessionId, forkingMsgId);
      showToast(`Session forked: ${newSessionId.substring(0,8)}`, "success");
    } catch (e) {
      showToast("Failed to fork session", "error");
    } finally {
      setForkingMsgId(null);
    }
  };

  // CP3-A: Validation Harness
  useEffect(() => {
    if (systemStatus === 'running' && !readOnly) {
      const runValidation = async () => {
        setValidating(true);
        const isValid = await knezClient.validateCognition();
        setValidating(false);
        if (isValid) {
          showToast("Cognition verified: Model is rational", "success");
        } else {
          showToast("Cognition check failed: Model may be unresponsive", "warning");
        }
      };
      const timer = setTimeout(runValidation, 1000);
      return () => clearTimeout(timer);
    }
  }, [systemStatus, readOnly, showToast]);

  // CP3-H: Smart Scroll
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(isBottom);
    }
  };

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  //   setIsAtBottom(true);
  // };

  const handleVoiceTranscript = (text: string) => {
    setInputValue(prev => prev + (prev ? " " : "") + text);
  };

  const renderOfflineOverlay = () => {
    if (systemStatus === "starting") {
      return (
        <div className="p-3 rounded-lg border border-blue-900/40 bg-blue-900/10 text-xs text-blue-200">
          Starting KNEZ... this can take up to 30 seconds on first boot.
        </div>
      );
    }
    if (readOnly) {
      return (
        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/30 text-xs text-zinc-300">
          Offline. Use Start in the header or Force Start in Settings.
          {systemStatus === "failed" && (
            <div className="mt-1 text-red-400">Previous launch failed. Open Settings for logs.</div>
          )}
        </div>
      );
    }
    return null;
  };

  const isTauri = useMemo(() => {
    const w = window as any;
    return !!(w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__ ?? w.__TAURI_IPC__);
  }, []);

  useEffect(() => {
    const el = termOutRef.current;
    if (!el) return;
    try {
      (el as any).scrollTo?.({ top: el.scrollHeight });
      if (typeof (el as any).scrollTo !== "function") el.scrollTop = el.scrollHeight;
    } catch {
      try { el.scrollTop = el.scrollHeight; } catch {}
    }
  }, [terminalOut]);

  const appendTerm = (line: string) => {
    setTerminalOut((prev) => (prev ? prev + "\n" + line : line));
  };

  const selectTerminalDirectory = async () => {
    if (!isTauri) {
      appendTerm("[WEB] Directory picker requires the desktop app (Tauri).");
      return;
    }
    try {
      const script =
        "Add-Type -AssemblyName System.Windows.Forms;" +
        "$d=New-Object System.Windows.Forms.FolderBrowserDialog;" +
        "$d.Description='Select working directory';" +
        "$d.ShowNewFolderButton=$true;" +
        "if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){$d.SelectedPath}";
      const res = await Command.create(
        "powershell",
        ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
        { encoding: "utf-8" }
      ).execute();
      const picked = String((res as any)?.stdout ?? "").trim();
      if (picked) {
        setTerminalCwd(picked);
        appendTerm(`[CWD] ${picked}`);
      }
    } catch (e: any) {
      appendTerm(`[ERROR] ${String(e?.message ?? e)}`);
    }
  };

  const stopTerminal = async () => {
    try {
      await termChildRef.current?.kill();
    } catch {}
    termChildRef.current = null;
    setTerminalRunning(false);
  };

  const runTerminal = async (override?: string) => {
    const cmd = String(override ?? terminalCmd).trim();
    if (!cmd) return;
    if (!isTauri) {
      appendTerm("[WEB] Terminal requires the desktop app (Tauri).");
      return;
    }
    if (terminalRunning) return;
    const cd = cmd.match(/^cd\s+(.+)$/i) || cmd.match(/^set-location\s+(.+)$/i);
    if (cd) {
      const p = String(cd[1]).trim().replace(/^["']|["']$/g, "");
      if (p) {
        setTerminalCwd(p);
        appendTerm(`[CWD] ${p}`);
      }
      return;
    }
    setTerminalRunning(true);
    appendTerm(`[RUN] ${cmd}`);
    try {
      const ps = Command.create(
        "powershell",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
        { encoding: "utf-8", cwd: terminalCwd || undefined }
      );
      ps.on("close", (evt) => {
        appendTerm(`[EXIT] code=${evt.code ?? "null"}`);
        termChildRef.current = null;
        setTerminalRunning(false);
      });
      ps.on("error", (err) => {
        appendTerm(`[ERROR] ${String((err as any)?.message ?? err)}`);
        termChildRef.current = null;
        setTerminalRunning(false);
      });
      ps.stdout.on("data", (line) => appendTerm(String(line).trimEnd()));
      ps.stderr.on("data", (line) => appendTerm(`[STDERR] ${String(line).trimEnd()}`));
      termChildRef.current = await ps.spawn();
    } catch (e: any) {
      appendTerm(`[ERROR] ${String(e?.message ?? e)}`);
      termChildRef.current = null;
      setTerminalRunning(false);
    }
  };

  useEffect(() => {
    const onRun = (e: any) => {
      const cmd = String(e?.detail?.command ?? "").trim();
      if (!cmd) return;
      setMode("chat");
      setComposerMode("terminal");
      setTerminalCmd(cmd);
      window.setTimeout(() => {
        if (e?.detail?.runNow) void runTerminal(cmd);
      }, 0);
    };
    window.addEventListener("knez-terminal-run", onRun as any);
    return () => window.removeEventListener("knez-terminal-run", onRun as any);
  }, [runTerminal]);

  // CP16: Enterprise Header
  return (
    <div className="flex flex-col h-full bg-zinc-950 relative">
      <div className="border-b border-zinc-800 bg-zinc-900/50 p-3 flex justify-between items-center backdrop-blur-sm sticky top-0 z-10">
         <div className="flex items-center gap-3">
            <div>
               <div 
                 className="font-bold text-zinc-100 text-sm"
               >
                 {sessionName || "Loading..."}
               </div>
               <div className="text-[10px] text-zinc-500 font-mono">ID: {sessionId?.substring(0,8)}...</div>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <div className="flex items-center border border-zinc-800 rounded-md overflow-hidden bg-zinc-950/40">
              <button
                type="button"
                onClick={() => setMode("chat")}
                className={`px-3 py-1.5 text-xs font-medium ${
                  mode === "chat" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Chat messages"
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMode("terminal")}
                className={`px-3 py-1.5 text-xs font-medium ${
                  mode === "terminal" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="In-chat terminal"
              >
                Terminal
              </button>
            </div>
            <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded border border-zinc-800 bg-zinc-950/40 text-[10px] font-mono text-zinc-400">
              <span>{online ? "online" : "offline"}</span>
              <span>•</span>
              <span>{(lastAssistant?.metrics as any)?.modelId ?? backend?.model_id ?? "model:n/a"}</span>
              <span>•</span>
              <span>{backendLabel}</span>
              <span>•</span>
              <span>mcp:{taqwinMcpStatus.state}</span>
              <span>•</span>
              <span>tools:{(taqwinMcpStatus as any).toolsCached ?? 0}</span>
            </div>
            <button
                onClick={() => {
                   sessionController.createNewSession();
                }}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                title="New Session"
             >
               <MessageSquarePlus size={18} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setHeaderMenuOpen((v) => !v)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                title="Menu"
              >
                <MoreVertical size={18} />
              </button>
              {headerMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setHistoryOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 flex items-center gap-2"
                  >
                    <History size={14} />
                    Session History
                  </button>
                  {features.floatingConsole && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        window.dispatchEvent(new CustomEvent("knez-open-console", { detail: { tab: "logs" } }));
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 flex items-center gap-2"
                    >
                      <TerminalSquare size={14} />
                      Open Console
                    </button>
                  )}
                  {features.mcpViews && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "mcp" } }));
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 flex items-center gap-2"
                    >
                      <Puzzle size={14} />
                      MCP Registry
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      window.dispatchEvent(new CustomEvent("knez-navigate", { detail: { view: "reflection" } }));
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 flex items-center gap-2"
                  >
                    <Sparkles size={14} />
                    Analyze
                  </button>
                  {features.taqwinTools && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        window.dispatchEvent(new CustomEvent("taqwin-activate"));
                      }}
                      disabled={taqwinActivation.state === "starting"}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        taqwinActivation.state === "error"
                          ? `TAQWIN ERROR: ${taqwinActivation.lastError ?? "unknown"}`
                          : taqwinActivation.state === "running"
                            ? "TAQWIN RUNNING"
                            : taqwinActivation.state === "starting"
                              ? "TAQWIN STARTING"
                              : "TAQWIN ACTIVATE"
                      }
                    >
                      {taqwinActivation.state === "starting" ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      Activate TAQWIN
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setRenameOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                  >
                    Rename Session
                  </button>
                </div>
              )}
            </div>
         </div>
      </div>

      {mode === "chat" ? (
        <>
          <div 
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
          >
            {renderOfflineOverlay()}

            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setVisibleCount(prev => Math.min(messages.length, prev + 50))}
                className="text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-2 w-full"
              >
                Load earlier messages ({hiddenCount} remaining)
              </button>
            )}
            
            {visibleMessages.map((msg, idx) => (
              <MessageItem 
                key={msg.id || idx} 
                msg={msg} 
                onEdit={handleEdit}
                onStop={handleStop}
                onRetry={handleRetry}
                readOnly={readOnly}
              />
            ))}
            <div ref={messagesEndRef} className="h-4" />
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
            <div className="flex gap-2 mb-2 px-1">
               <button 
                 data-testid="search-toggle"
                 type="button"
                 onClick={() => {
                   const next = { ...activeTools, search: !activeTools.search };
                   chatService.setActiveTools(next);
                 }}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                   activeTools.search 
                     ? "bg-blue-600 text-white shadow-blue-900/50 shadow-sm" 
                     : "bg-transparent border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                 }`}
               >
                 <Search size={14} />
                 <span>{activeTools.search ? 'Search On' : 'Search Off'}</span>
               </button>
               <button
                 type="button"
                 onClick={() => setAuditOpen(true)}
                 className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-transparent border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-all"
                 title="Chat State Audit"
               >
                 <span>Audit</span>
               </button>
               {features.taqwinTools && (
                 <button
                   type="button"
                   onClick={() => setToolsOpen(true)}
                   className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-transparent border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-all"
                   title="TAQWIN Tools"
                   aria-label="Tools"
                 >
                  <span className="flex items-center gap-2">
                    Tools
                    <span className="text-[10px] text-zinc-500" aria-hidden="true">
                      {(taqwinMcpStatus as any).toolsCached ?? 0}
                    </span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        taqwinMcpStatus.state === "running"
                          ? "bg-emerald-400"
                          : taqwinMcpStatus.state === "starting"
                            ? "bg-amber-400"
                            : taqwinMcpStatus.state === "error"
                              ? "bg-red-400"
                              : "bg-zinc-500"
                      }`}
                      title={`TAQWIN MCP: ${taqwinMcpStatus.state}`}
                    />
                  </span>
                 </button>
               )}
            </div>
            {features.logViews && (
              <div className="px-1 mb-2 text-[10px] text-zinc-500 font-mono">
                search_provider={activeTools.search ? searchProvider : "off"}
              </div>
            )}
            {canContinue && (
              <div className="px-1 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    const tail = (lastAssistant?.text ?? "").slice(-2000);
                    void chatService.sendMessage("Continue", `\n\n[SYSTEM: Continue]\nResume from the last assistant output:\n${tail}`);
                  }}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg"
                >
                  Continue
                </button>
              </div>
            )}

            {composerMode === "terminal" && (
              <div className="mb-3 border border-zinc-800 rounded-lg bg-zinc-950/40 overflow-hidden">
                <div className="p-2 border-b border-zinc-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void selectTerminalDirectory()}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs flex items-center gap-2"
                    title="Select working directory"
                  >
                    <FolderOpen size={14} />
                    Dir
                  </button>
                  <input
                    value={terminalCwd}
                    onChange={(e) => setTerminalCwd(e.target.value)}
                    placeholder="cwd (optional)"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => void setTerminalOut("")}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs"
                  >
                    Clear
                  </button>
                </div>
                <div ref={termOutRef} className="max-h-44 overflow-y-auto p-2 font-mono text-[11px] text-zinc-200 whitespace-pre-wrap">
                  {terminalOut || "Terminal ready."}
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                if (composerMode === "terminal") {
                  e.preventDefault();
                  void runTerminal();
                  return;
                }
                void handleSend(e);
              }}
              className="relative flex gap-2"
            >
              <button
                type="button"
                onClick={() => {
                  const next = composerMode === "chat" ? "terminal" : "chat";
                  setComposerMode(next);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  composerMode === "terminal"
                    ? "bg-blue-600 border-blue-500 text-white hover:bg-blue-500"
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white"
                }`}
                title={composerMode === "chat" ? "Switch to terminal input" : "Switch to chat input"}
              >
                <TerminalSquare size={16} />
              </button>
              {composerMode === "chat" && <VoiceInput onTranscript={handleVoiceTranscript} />}
              <input
                data-testid="chat-input"
                autoFocus
                type="text"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-600"
                placeholder={
                  composerMode === "terminal"
                    ? "Type a PowerShell command..."
                    : readOnly
                      ? "System is offline..."
                      : "Type a message..."
                }
                value={composerMode === "terminal" ? terminalCmd : inputValue}
                onChange={(e) => {
                  if (composerMode === "terminal") setTerminalCmd(e.target.value);
                  else setInputValue(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (composerMode !== "terminal") return;
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void runTerminal();
                  }
                }}
              />
              {composerMode === "chat" && sending && (
                <button
                  type="button"
                  onClick={() => chatService.stopCurrentResponse()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors"
                  title="Stop current response"
                >
                  <div className="flex items-center gap-2">
                    <Square size={14} />
                    <span>Stop</span>
                  </div>
                </button>
              )}
              {composerMode === "terminal" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void runTerminal()}
                    disabled={terminalRunning}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"
                  >
                    <Play size={14} />
                    Run
                  </button>
                  <button
                    type="button"
                    onClick={() => void stopTerminal()}
                    disabled={!terminalRunning}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-50"
                    title="Stop terminal command"
                  >
                    <div className="flex items-center gap-2">
                      <Square size={14} />
                      <span>Stop</span>
                    </div>
                  </button>
                </>
              ) : (
                <button
                  data-testid="chat-send"
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-900/20"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              )}
            </form>
            
            {validating && (
               <div className="absolute top-0 right-0 -mt-8 mr-4 text-[10px] text-zinc-500 flex items-center gap-2">
                  <div className="w-2 h-2 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
                  Validating Cognition...
               </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-hidden">
          <ChatTerminalPane />
        </div>
      )}

      <ForkModal 
        isOpen={!!forkingMsgId} 
        onClose={() => setForkingMsgId(null)} 
        onConfirm={handleFork} 
      />
      <RenameModal
        isOpen={renameOpen}
        initialName={sessionName}
        onClose={() => setRenameOpen(false)}
        onSave={handleRename}
      />
      <AuditModal
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        sessionId={sessionId}
        messages={messages}
      />
      <TaqwinToolsModal
        isOpen={toolsOpen}
        onClose={() => setToolsOpen(false)}
      />
      <HistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentSessionId={sessionId}
        onInspect={(sid) => {
          setInspectSessionId(sid);
          setHistoryOpen(false);
        }}
      />
      <SessionInspectorModal
        isOpen={!!inspectSessionId}
        onClose={() => setInspectSessionId(null)}
        sessionId={inspectSessionId}
      />
    </div>
  );
};
