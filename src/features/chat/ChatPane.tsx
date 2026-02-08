import React, { useEffect, useRef, useState } from "react";
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
import { History, MessageSquarePlus, Search, Square, Trash2 } from "lucide-react";
import { TaqwinToolsModal } from "./TaqwinToolsModal";
import { useStatus } from "../../contexts/useStatus";

// CP17: History Modal
const HistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string | null;
}> = ({ isOpen, onClose, currentSessionId }) => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<{id: string, name: string, updatedAt: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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
          {loading ? (
             <div className="p-8 text-center text-zinc-500 text-xs">Loading sessions...</div>
          ) : sessions.length === 0 ? (
             <div className="p-8 text-center text-zinc-500 text-xs">No history found.</div>
          ) : (
            sessions.map(s => (
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
                  </button>
                  <div className="flex items-center gap-2">
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
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTools, setActiveTools] = useState<{ search: boolean }>({ search: false });
  const [searchProvider, setSearchProvider] = useState<"off" | "taqwin" | "proxy">("off");
  
  const [inputValue, setInputValue] = useState("");
  const [validating, setValidating] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [forkingMsgId, setForkingMsgId] = useState<string | null>(null);
  
  // CP15
  const [sessionName, setSessionName] = useState<string>("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { online, health } = useStatus();
  const backend = health?.backends?.[0];
  const lastAssistant = [...messages].reverse().find((m) => m.from === "knez");
  const canContinue = !readOnly && !sending && (lastAssistant?.metrics as any)?.finishReason === "stopped";
  const maxMessages = 250;
  const hiddenCount = Math.max(0, messages.length - maxMessages);
  const visibleMessages = showAllMessages || hiddenCount === 0 ? messages : messages.slice(-maxMessages);

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
    
    // UI clears immediately, service handles logic
    setInputValue("");
    setIsAtBottom(true);
    
    await chatService.sendMessage(inputValue);
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

  const handleVote = (messageId: string, vote: "upvote" | "downvote") => {
    if (readOnly) return;
    if (sessionId) {
      knezClient.submitVote(sessionId, messageId, vote);
    }
  };

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
            <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded border border-zinc-800 bg-zinc-950/40 text-[10px] font-mono text-zinc-400">
              <span>{online ? "online" : "offline"}</span>
              <span>•</span>
              <span>{(lastAssistant?.metrics as any)?.modelId ?? backend?.model_id ?? "model:n/a"}</span>
              <span>•</span>
              <span>{backend?.status ?? "status:n/a"}</span>
            </div>
            <button
               onClick={() => setHistoryOpen(true)}
               className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
               title="Session History"
            >
               <History size={18} />
            </button>
            <button
                onClick={() => {
                   sessionController.createNewSession();
                }}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                title="New Session"
             >
               <MessageSquarePlus size={18} />
            </button>
            <button
              onClick={() => setRenameOpen(true)}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded transition-colors"
            >
              Rename
            </button>
         </div>
      </div>

      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        {renderOfflineOverlay()}

        {hiddenCount > 0 && !showAllMessages && (
          <button
            type="button"
            onClick={() => setShowAllMessages(true)}
            className="text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-2 w-full"
          >
            Load earlier messages ({hiddenCount})
          </button>
        )}
        
        {visibleMessages.map((msg, idx) => (
          <MessageItem 
            key={msg.id || idx} 
            msg={msg} 
            onVote={handleVote}
            // onFork={(mid: string) => setForkingMsgId(mid)} // Temporarily removed to fix type error if MessageItem doesn't support it
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
           <button
             type="button"
             onClick={() => setToolsOpen(true)}
             className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-transparent border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-all"
             title="TAQWIN Tools"
           >
             <span>Tools</span>
           </button>
        </div>
        <div className="px-1 mb-2 text-[10px] text-zinc-500 font-mono">
          search_provider={activeTools.search ? searchProvider : "off"}
        </div>
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

        <form onSubmit={handleSend} className="relative flex gap-2">
          <VoiceInput onTranscript={handleVoiceTranscript} />
          <input
            data-testid="chat-input"
            autoFocus
            type="text"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-600"
            placeholder={readOnly ? "System is offline..." : "Type a message..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={readOnly}
          />
          {sending && !readOnly && (
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
          <button
            data-testid="chat-send"
            type="submit"
            disabled={!inputValue.trim() || readOnly}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-900/20"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
        
        {validating && (
           <div className="absolute top-0 right-0 -mt-8 mr-4 text-[10px] text-zinc-500 flex items-center gap-2">
              <div className="w-2 h-2 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
              Validating Cognition...
           </div>
        )}
      </div>

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
      />
    </div>
  );
};
