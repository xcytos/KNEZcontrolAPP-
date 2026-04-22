import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage, AssistantMessage } from "../../domain/DataContracts";
import { AssistantMessageRenderer } from "./blocks/AssistantMessageRenderer";
import { knezClient } from '../../services/knez/KnezClient';
import { MessageItem } from "./MessageItem";
import { getMemoryEventSourcingService } from '../../services/memory/storage/MemoryEventSourcingService';
import { MemoryData } from "../../services/memory/StaticMemoryLoader";
// import { exportChat } from "./ChatUtils";
import { useToast } from "../../components/ui/Toast";
// import { PerceptionPanel } from "../perception/PerceptionPanel";
import { VoiceInput } from "../voice/VoiceInput";
// import { observe } from "../../utils/observer";
import { chatService } from '../../services/ChatService';
import { sessionDatabase } from '../../services/session/SessionDatabase';
import { sessionController } from '../../services/session/SessionController';
import { logger } from '../../services/utils/LogService';
import { FolderOpen, History, Loader2, MessageSquarePlus, MoreVertical, Play, Search, Square, TerminalSquare, Puzzle, Sparkles, Zap, Bug, Database, ArrowUp, Download, Upload } from "lucide-react";
import { SessionInspectorModal } from "./SessionInspectorModal";
import { DebugPanel } from "./DebugPanel";
import { useStatus } from "../../contexts/useStatus";
import { backendHasLiveMetrics, isBackendHealthyStatus, selectPrimaryBackend } from "../../utils/health";
import { features } from "../../config/features";
import { useTaqwinActivationStatus } from "../../hooks/useTaqwinActivationStatus";
import { ChatTerminalPane } from "./ChatTerminalPane";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { toolExposureService } from "../../services/mcp/ToolExposureService";
import { mcpOrchestrator } from "../../mcp/McpOrchestrator";
import { HistoryModal } from "./modals/HistoryModal";
import { ForkModal } from "./modals/ForkModal";
import { RenameModal } from "./modals/RenameModal";
import { AuditModal } from "./modals/AuditModal";
import { AvailableToolsModal } from "./modals/AvailableToolsModal";
import { MemoryModal } from "./MemoryModal";
import { ChatMemorySyncModal } from "./ChatMemorySyncModal";
// Manual approval removed - tools auto-approve
// import { ToolApprovalModal } from "./ToolApprovalModal";
type Props = {
  sessionId: string | null;
  readOnly: boolean;
  systemStatus?: "idle" | "starting" | "running" | "failed" | "degraded";
};

export const ChatPane: React.FC<Props> = ({ sessionId, readOnly, systemStatus }) => {
  // const [showPerception, setShowPerception] = useState(false);
  // Use ChatService state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [phase, setPhase] = useState<"idle" | "sending" | "thinking" | "tool_running" | "streaming" | "finalizing" | "done" | "error">("idle");
  const [activeTools, setActiveTools] = useState<{ search: boolean }>({ search: false });
  const [searchProvider, setSearchProvider] = useState<"off" | "taqwin" | "proxy">("off");
  const [insertAboveIdx, setInsertAboveIdx] = useState<number | null>(null);
  const [insertValue, setInsertValue] = useState("");
  const [isMounted, setIsMounted] = useState(true);
  // Manual approval removed - tools auto-approve
  // const [pendingToolApproval, setPendingToolApproval] = useState<ChatState["pendingToolApproval"]>(null);
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
  const [availableToolsOpen, setAvailableToolsOpen] = useState(false);
  const [inspectSessionId, setInspectSessionId] = useState<string | null>(null);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [chatMemorySyncOpen, setChatMemorySyncOpen] = useState(false);
  const [mode, setMode] = useState<"chat" | "terminal">("chat");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
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
  const backend = selectPrimaryBackend(health?.backends);
  const backendLabel = backend
    ? isBackendHealthyStatus(backend.status)
      ? backendHasLiveMetrics(backend)
        ? "healthy"
        : "stale"
      : String(backend.status ?? "down")
    : "status:n/a";
  const lastAssistant = [...messages].reverse().find((m) => m.from === "knez");
  const canContinue = !readOnly && phase === "idle" && (lastAssistant?.metrics as any)?.finishReason === "stopped";
  const [visibleCount, setVisibleCount] = useState(50);
  const [toolExposureTick, setToolExposureTick] = useState(0);
  const [mcpTick, setMcpTick] = useState(0);
  const exposedTools = useMemo(() => toolExposureService.getCatalog(), [toolExposureTick]);
  const exposedAllowedCount = useMemo(() => toolExposureService.getToolsForModel().length, [toolExposureTick]);
  const runtimeById = useMemo(() => mcpOrchestrator.getSnapshot().servers, [mcpTick]);
  const [toolPanelError, setToolPanelError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const sendDebounceRef = useRef<number | null>(null);

  // Reset visible count when session changes
  useEffect(() => {
    setVisibleCount(50);
  }, [sessionId]);

  // Cleanup on unmount to prevent stale state updates
  useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

  const hiddenCount = Math.max(0, messages.length - visibleCount);
  const visibleMessages = messages.slice(-visibleCount);

  useEffect(() => {
    return toolExposureService.subscribe(() => setToolExposureTick((v) => (v + 1) % 1000000));
  }, []);

  useEffect(() => {
    return mcpOrchestrator.subscribe(() => setMcpTick((v) => (v + 1) % 1000000));
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
    window.addEventListener("chat-focus-message", onFocus);
    return () => window.removeEventListener("chat-focus-message", onFocus);
  }, []);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('knez_chat_draft');
    if (savedDraft && inputValue === "") {
      setInputValue(savedDraft);
    }
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (inputValue) {
      localStorage.setItem('knez_chat_draft', inputValue);
    } else {
      localStorage.removeItem('knez_chat_draft');
    }
  }, [inputValue]);

  // Accessibility: Escape to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (debugPanelOpen) setDebugPanelOpen(false);
        else if (historyOpen) setHistoryOpen(false);
        else if (auditOpen) setAuditOpen(false);
        else if (renameOpen) setRenameOpen(false);
        else if (headerMenuOpen) setHeaderMenuOpen(false);
      }
      if (e.ctrlKey && e.key === "k") {
        // New session
        // TODO: Implement new session logic
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyOpen, auditOpen, renameOpen, headerMenuOpen, debugPanelOpen]);

  // Sync with Service
  useEffect(() => {
    const unsub = chatService.subscribe((state) => {
      if (isMounted) {
        setMessages(state.messages);
        setAssistantMessages(state.assistantMessages);
        setPhase(state.phase);
        setActiveTools(state.activeTools);
        setSearchProvider(state.searchProvider);
      }
       // Manual approval removed - tools auto-approve
       // setPendingToolApproval(state.pendingToolApproval);
    });
    return unsub;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;
    sessionDatabase.getSession(sessionId).then(s => {
      if (mounted) {
        if (s) setSessionName(s.name);
        else setSessionName(`Session ${sessionId.substring(0,6)}`);
      }
    });
    return () => { mounted = false; };
  }, [sessionId]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;
    if (readOnly) return;
    if (isSending) {
      logger.warn("chat_pane", "send_blocked_already_sending", { message: "Message send blocked - already sending" });
      return;
    }

    // Clear any pending debounce
    if (sendDebounceRef.current !== null) {
      clearTimeout(sendDebounceRef.current);
    }

    // Set isSending immediately to block concurrent sends
    setIsSending(true);

    // T4+T8: Gate send on KNEZ online status
    if (!online) {
      showToast("KNEZ not ready. Please wait for connection.", "warning");
      setIsSending(false);
      return;
    }

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

  // Reset isSending when phase changes to idle
  useEffect(() => {
    if (phase === "idle") {
      setIsSending(false);
    }
  }, [phase]);

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

  const handleExportSession = async () => {
    if (!sessionId) return;
    try {
      const session = await sessionDatabase.getSession(sessionId);
      const messages = await sessionDatabase.loadMessages(sessionId);
      const exportData = {
        session,
        messages,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${sessionId.substring(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Session exported successfully", "success");
    } catch (e) {
      showToast("Failed to export session", "error");
    }
  };

  const handleImportSession = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.session || !data.messages) {
        showToast("Invalid session file format", "error");
        return;
      }
      const newSessionId = await sessionController.createNewSession();
      await sessionDatabase.saveSession(newSessionId, data.session.name || 'Imported Session');
      await sessionDatabase.saveMessages(newSessionId, data.messages.map((msg: any) => ({ ...msg, sessionId: newSessionId })));
      showToast(`Session imported: ${newSessionId.substring(0,8)}`, "success");
    } catch (e) {
      showToast("Failed to import session", "error");
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

  // P5.2 T6: AgentProgressBar — shows thinking/executing/generating stages based on phase
  const AgentProgressBar: React.FC<{
    phase: "idle" | "sending" | "thinking" | "tool_running" | "streaming" | "finalizing" | "done" | "error";
    messages: ChatMessage[];
  }> = ({ phase, messages }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const activeToolMsg = [...messages].reverse().find(
      (m: ChatMessage) => m.toolCall?.status === "running" || m.toolCall?.status === "pending"
    );

    // P5.2 T7: Collapse based on lifecycle (idle or done phase)
    const shouldHide = phase === "idle" || phase === "done";

    // P5.2 T7: Auto-collapse when phase completes
    useEffect(() => {
      if (phase === "idle" || phase === "done") {
        const timer = setTimeout(() => setIsCollapsed(true), 2000);
        return () => clearTimeout(timer);
      } else {
        setIsCollapsed(false);
      }
    }, [phase]);

    if (shouldHide) return null;

    let stage = "";
    let stageColor = "bg-blue-400";
    if (activeToolMsg || phase === "tool_running") {
      const toolShortName = activeToolMsg?.toolCall?.tool.split("__").pop() ?? "tool";
      stage = `executing: ${toolShortName}`;
      stageColor = "bg-green-400";
    } else if (phase === "streaming") {
      stage = "generating response...";
      stageColor = "bg-purple-400";
    } else if (phase === "thinking") {
      stage = "thinking...";
      stageColor = "bg-yellow-400";
    } else if (phase === "sending") {
      stage = "sending...";
    } else if (phase === "error") {
      stage = "error";
      stageColor = "bg-red-400";
    }

    if (isCollapsed) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-400 border-t border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors"
             onClick={() => setIsCollapsed(false)}>
          <div className={`w-1.5 h-1.5 rounded-full ${stageColor}`} />
          <span>{stage}</span>
          <span className="text-zinc-500">(click to expand)</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-400 border-t border-zinc-800">
        <div className={`w-1.5 h-1.5 rounded-full ${stageColor} animate-pulse`} />
        <span>{stage}</span>
        {phase === "streaming" && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Toggle visibility"
          >
            {isCollapsed ? "▶" : "▼"}
          </button>
        )}
      </div>
    );
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
    window.addEventListener("knez-terminal-run", onRun);
    return () => window.removeEventListener("knez-terminal-run", onRun);
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
         <div className="flex items-center gap-2" style={{ zIndex: 1000, position: 'relative' }}>
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
              <span>mcp_tools:{exposedAllowedCount}</span>
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
            <button
                onClick={() => setDebugPanelOpen(true)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                title="Debug Panel - Tool Execution History"
             >
               <Bug size={18} />
            </button>
            <button
                onClick={handleExportSession}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                title="Export Session"
             >
               <Download size={18} />
            </button>
            <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) void handleImportSession(file);
                  };
                  input.click();
                }}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                title="Import Session"
             >
               <Upload size={18} />
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
                <div className="absolute right-0 mt-2 w-52 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden" style={{ zIndex: 2000 }}>
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
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setMemoryModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 flex items-center gap-2"
                  >
                    <MessageSquarePlus size={14} />
                    +Memory
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setChatMemorySyncOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 flex items-center gap-2"
                  >
                    <Database size={14} />
                    Sync Chat to Memory
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
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 scroll-smooth max-w-full min-w-0"
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
            
            {(() => {
              // Filter out assistant-type ChatMessages to prevent double rendering with AssistantMessage blocks
              const filteredMessages = visibleMessages.filter(m => m.from !== "knez" && m.from !== "assistant");
              
              // Merge assistant messages with regular messages and sort by creation time
              type MergedItem = { type: 'message', data: ChatMessage } | { type: 'assistant', data: AssistantMessage };
              const mergedMessages: MergedItem[] = [
                ...filteredMessages.map(m => ({ type: 'message' as const, data: m })),
                ...assistantMessages.map(am => ({ type: 'assistant' as const, data: am }))
              ].sort((a, b) => {
                const timeA = new Date(a.data.createdAt).getTime();
                const timeB = new Date(b.data.createdAt).getTime();
                return timeA - timeB;
              });

              return mergedMessages.map((item, idx) => {
                const isLast = idx === mergedMessages.length - 1;
                const showArrow = !isLast && item.type === 'assistant' && phase === "idle";

                return (
                  <React.Fragment key={item.data.id || idx}>
                    {showArrow && (
                      <div className="flex justify-center my-2">
                        <button
                          type="button"
                          onClick={() => setInsertAboveIdx(insertAboveIdx === idx ? null : idx)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-xs transition-all"
                          title="Insert message above"
                        >
                          <ArrowUp size={14} />
                          <span>Add message above</span>
                        </button>
                      </div>
                    )}
                    {insertAboveIdx === idx && (
                      <div className="flex justify-center my-2">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (insertValue.trim()) {
                              void chatService.sendMessage(insertValue, `[SYSTEM: Inserted above message ${idx}]`);
                              setInsertValue("");
                              setInsertAboveIdx(null);
                            }
                          }}
                          className="flex gap-2 w-full max-w-2xl"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={insertValue}
                            onChange={(e) => setInsertValue(e.target.value)}
                            placeholder="Type a message to insert above..."
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                          />
                          <button
                            type="submit"
                            disabled={!insertValue.trim()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Insert
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInsertAboveIdx(null);
                              setInsertValue("");
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </form>
                      </div>
                    )}
                    {item.type === 'message' ? (
                      <MessageItem
                        key={item.data.id || idx}
                        msg={item.data}
                        onEdit={handleEdit}
                        onStop={handleStop}
                        onRetry={handleRetry}
                        readOnly={readOnly}
                      />
                    ) : (
                      <div className="flex gap-3 max-w-full min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-zinc-400">Assistant</span>
                            <span className="text-[10px] text-zinc-600">{new Date(item.data.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-sm text-zinc-300">
                            <AssistantMessageRenderer
                              blocks={item.data.blocks}
                              onApprovalApprove={() => {}}
                              onApprovalReject={() => {}}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              });
            })()}

            {/* Prominent status indicator when AI is processing - hide when streaming has started to avoid duplicate icons */}
            {(phase === "sending" || phase === "thinking" || phase === "tool_running") && (
              <div className="flex gap-3 max-w-full min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white shadow-lg shadow-indigo-500/20">
                  AI
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-zinc-400">Assistant</span>
                    <div className="flex items-center gap-2">
                      {phase === "sending" && (
                        <>
                          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                          <span className="text-xs text-zinc-400">Sending prompt...</span>
                        </>
                      )}
                      {phase === "thinking" && (
                        <>
                          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                          <span className="text-xs text-zinc-400">Thinking...</span>
                        </>
                      )}
                      {phase === "tool_running" && (
                        <>
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-xs text-zinc-400">Executing tools...</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {phase === "sending" && "Your prompt has been received and is being sent to the AI model..."}
                      {phase === "thinking" && "The AI is analyzing your request and formulating a response..."}
                      {phase === "tool_running" && "The AI is executing tools to gather information..."}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Queue status indicator */}
            {messages.length === 0 && phase === "idle" && (
              <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                <span>No messages yet. Start a conversation by typing a message below.</span>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* P5.2 T6: AgentProgressBar above input bar */}
          <AgentProgressBar phase={phase} messages={messages} />

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
                 onClick={() => setAvailableToolsOpen(true)}
                 className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-transparent border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-all"
                 title="Available Tools"
               >
                 <Puzzle size={14} />
                 <span>Tools</span>
               </button>
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
                <div ref={termOutRef} className="max-h-44 overflow-y-auto overflow-x-hidden p-2 font-mono text-[11px] text-zinc-200 whitespace-pre-wrap break-words max-w-full min-w-0">
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
              {composerMode === "chat" && (phase === "streaming" || phase === "thinking" || phase === "tool_running" || phase === "sending") && (
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
                  disabled={!inputValue.trim() || phase === "streaming" || phase === "thinking" || phase === "tool_running" || phase === "sending"}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-900/20"
                >
                  {phase === "streaming" ? "Streaming..." : phase === "sending" ? "Sending..." : "Send"}
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
      <AvailableToolsModal
        isOpen={availableToolsOpen}
        onClose={() => setAvailableToolsOpen(false)}
        tools={exposedTools as any}
        runtimeById={runtimeById as any}
        panelError={toolPanelError}
        onStartServer={(serverId) => {
          setToolPanelError(null);
          void mcpOrchestrator.ensureStarted(serverId).catch((e: any) => {
            const msg = String(e?.message ?? e);
            setToolPanelError(msg);
            showToast(msg, "error");
          });
        }}
        onRefreshTools={(serverId) => {
          setToolPanelError(null);
          void mcpOrchestrator.refreshTools(serverId, { waitForResult: true, timeoutMs: 60000 }).catch((e: any) => {
            const msg = String(e?.message ?? e);
            setToolPanelError(msg);
            showToast(msg, "error");
          });
        }}
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
      <DebugPanel
        messages={messages}
        isOpen={debugPanelOpen}
        onClose={() => setDebugPanelOpen(false)}
      />
      <ChatMemorySyncModal
        isOpen={chatMemorySyncOpen}
        onClose={() => setChatMemorySyncOpen(false)}
        onInjected={(count) => {
          showToast(`Synced ${count} memories to database`, "success");
        }}
      />
      <MemoryModal
        isOpen={memoryModalOpen}
        onClose={() => setMemoryModalOpen(false)}
        onInject={async (memory: MemoryData) => {
          try {
            const memoryService = getMemoryEventSourcingService();
            await memoryService.createMemory(
              memory.type,
              memory.title,
              memory.content,
              memory.domain,
              memory.tags,
              memory.metadata
            );
            showToast(`Memory "${memory.title}" injected successfully`, "success");
          } catch (error) {
            showToast(`Failed to inject memory: ${error}`, "error");
          }
        }}
      />
      {/* Manual approval removed - tools auto-approve */}
    </div>
  );
};
