import React, { useEffect, useRef, useState } from "react";
import { ChatMessage } from "../../domain/DataContracts";
import { knezClient } from "../../services/KnezClient";
import { MessageItem } from "./MessageItem";
import { exportChat } from "./ChatUtils";
import { useToast } from "../../components/ui/Toast";
import { PerceptionPanel } from "../perception/PerceptionPanel";
import { VoiceInput } from "../voice/VoiceInput";
import { observe } from "../../utils/observer";

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

type Props = {
  sessionId: string | null;
  readOnly: boolean;
  onLaunch?: () => void;
  systemStatus?: "idle" | "starting" | "running" | "failed" | "degraded";
};

export const ChatPane: React.FC<Props> = ({ sessionId, readOnly, onLaunch, systemStatus }) => {
  console.log("ChatPane Render: systemStatus=", systemStatus, "readOnly=", readOnly);
  const [showPerception, setShowPerception] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [validating, setValidating] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [forkingMsgId, setForkingMsgId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const handleFork = async () => {
    if (!sessionId || !forkingMsgId) return;
    try {
      const newSessionId = await knezClient.forkSession(sessionId, forkingMsgId);
      showToast(`Session forked: ${newSessionId.substring(0,8)}`, "success");
      window.location.reload(); 
    } catch (e) {
      showToast("Failed to fork session", "error");
    } finally {
      setForkingMsgId(null);
    }
  };


  // CP3-D: Persistence
  useEffect(() => {
    if (!sessionId) return;
    const key = `knez_chat_${sessionId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        // invalid data
      }
    } else {
       setMessages([{
          id: "seed",
          sessionId: sessionId,
          from: "knez",
          text: "KNEZ client ready.",
          createdAt: new Date().toISOString(),
       }]);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    localStorage.setItem(`knez_chat_${sessionId}`, JSON.stringify(messages));
  }, [messages, sessionId]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // CP2-B: Chat-First Entry logic
    if (systemStatus === "idle" || systemStatus === "failed") {
      if (onLaunch) onLaunch();
    }
    
    if (readOnly && systemStatus !== "running" && systemStatus !== "degraded") return;
    if (!sessionId) return;
    if (!inputValue.trim() || sending) return;

    observe("chat_send_attempt", { sessionId, message: inputValue });

    const now = new Date().toISOString();
    const startTime = Date.now();
    
    const userMsg: ChatMessage = {
      id: `${startTime}`,
      sessionId,
      from: "user",
      text: inputValue,
      createdAt: now,
    };

    const assistantId = `${startTime}-assistant`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      sessionId,
      from: "knez",
      text: "",
      createdAt: now,
      isPartial: true,
      metrics: {
        totalTokens: 0,
      }
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputValue("");
    setSending(true);
    setIsAtBottom(true);

    observe("chat_optimistic_update", { msgId: userMsg.id });

    const completionMessages = [...messages, userMsg]
      .filter((m) => m.id !== "seed")
      .map((m) => {
        const role = m.from === "user" ? "user" : "assistant";
        return { role, content: m.text } as const;
      });

    try {
      let collected = "";
      let firstTokenTime: number | undefined;
      let tokenCount = 0;

      for await (const token of knezClient.chatCompletionsStream(
        completionMessages,
        sessionId
      )) {
        if (!firstTokenTime) firstTokenTime = Date.now();
        collected += token;
        tokenCount++;
        
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { 
            ...m, 
            text: collected,
            metrics: {
              timeToFirstTokenMs: firstTokenTime! - startTime,
              totalTokens: tokenCount
            }
          } : m))
        );
      }

      if (!collected) {
        const text = await knezClient.chatCompletionsNonStream(
          completionMessages,
          sessionId
        );
        collected = text;
        tokenCount = text.split(/\s+/).length; 
        
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { 
            ...m, 
            text,
            metrics: {
              timeToFirstTokenMs: Date.now() - startTime,
              totalTokens: tokenCount
            }
          } : m))
        );
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { 
          ...m, 
          isPartial: false,
          metrics: {
            ...m.metrics,
            finishReason: "stop"
          }
        } : m))
      );

      observe("chat_complete", { sessionId });

    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showToast("Generation failed: " + errorMsg, "error");
      observe("chat_error", { error: errorMsg });
      
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: m.text ? m.text : `Delivery Failure: ${errorMsg}`, 
                refusal: true,
                isPartial: false,
                metrics: {
                  ...m.metrics,
                  finishReason: "error"
                }
              }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleVote = (messageId: string, vote: "upvote" | "downvote") => {
    if (readOnly) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, influence: { ...m.influence, vote } }
          : m
      )
    );
    if (sessionId) {
      knezClient.submitVote(sessionId, messageId, vote);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setInputValue(prev => prev + (prev ? " " : "") + text);
  };

  const renderOfflineOverlay = () => {
    if (readOnly && (systemStatus === "idle" || systemStatus === "failed")) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-zinc-500 text-sm">System is offline.</div>
          <button 
            onClick={onLaunch}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
          >
            Launch KNEZ & Start AI
          </button>
          {systemStatus === "failed" && (
            <div className="text-red-400 text-xs">Previous launch failed. Check settings for logs.</div>
          )}
       </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header / Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-2 bg-zinc-900/80 backdrop-blur border-b border-zinc-800">
        <div className="flex items-center gap-2">
           <span className="text-xs font-mono text-zinc-500">
             {sessionId ? `SESSION: ${sessionId.substring(0,8)}` : 'NO SESSION'}
           </span>
           {validating && <span className="text-[10px] text-blue-400 animate-pulse">VALIDATING COGNITION...</span>}
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowPerception(!showPerception)}
             className={`text-xs px-2 py-1 rounded transition-colors ${showPerception ? 'bg-purple-900/50 text-purple-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
             title="Toggle Perception"
           >
             👁 View
           </button>
           <button 
             onClick={() => setForkingMsgId(messages[messages.length-1]?.id)} 
             className="text-xs text-zinc-400 hover:text-white px-2 py-1 hover:bg-zinc-800 rounded transition-colors"
             title="Fork latest"
             disabled={messages.length === 0}
           >
             Fork ⑂
           </button>
           <button 
             onClick={() => exportChat(messages, sessionId || 'unknown')}
             className="text-xs text-zinc-400 hover:text-white px-2 py-1 hover:bg-zinc-800 rounded transition-colors"
             title="Export Session"
             disabled={messages.length === 0}
           >
             Export ⭳
           </button>
        </div>
      </div>
      
      <ForkModal 
        isOpen={!!forkingMsgId}
        onClose={() => setForkingMsgId(null)}
        onConfirm={handleFork}
      />
      
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-6 mt-10"
      >
        {showPerception && (
          <div className="mb-4 h-64 border border-purple-900/50 rounded-lg overflow-hidden shrink-0">
             <PerceptionPanel />
          </div>
        )}

        {renderOfflineOverlay()}

        {messages.map((msg) => (
          <MessageItem 
            key={msg.id} 
            msg={msg} 
            readOnly={readOnly} 
            onVote={handleVote} 
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Smart Scroll Button */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow-lg hover:bg-blue-500 transition-all z-20"
        >
          ↓ New messages
        </button>
      )}

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <form onSubmit={handleSend} className="relative flex gap-2">
          <VoiceInput onTranscript={handleVoiceTranscript} />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={readOnly ? "Read-only mode" : "Type a message..."}
            disabled={readOnly || !sessionId || sending}
            className="w-full bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={readOnly || !sessionId || sending || !inputValue.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            ⏎
          </button>
        </form>
      </div>
    </div>
  );
};
