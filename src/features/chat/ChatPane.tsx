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
  
  const [inputValue, setInputValue] = useState("");
  const [validating, setValidating] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [forkingMsgId, setForkingMsgId] = useState<string | null>(null);
  
  // CP15
  const [sessionName, setSessionName] = useState<string>("");
  const [renameOpen, setRenameOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Sync with Service
  useEffect(() => {
    if (sessionId) {
       chatService.setSessionId(sessionId);
       // Load name
       sessionDatabase.getSession(sessionId).then(s => {
          if (s) setSessionName(s.name);
          else setSessionName(`Session ${sessionId.substring(0,6)}`);
       });
    }
    
    const unsub = chatService.subscribe((state) => {
       setMessages(state.messages);
       setSending(state.sending);
       setActiveTools(state.activeTools);
    });
    return unsub;
  }, [sessionId]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (readOnly || !inputValue.trim()) return;
    
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
      const newSessionId = await knezClient.forkSession(sessionId, forkingMsgId);
      showToast(`Session forked: ${newSessionId.substring(0,8)}`, "success");
      window.location.reload(); 
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
    if (readOnly && (systemStatus === "idle" || systemStatus === "failed")) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-zinc-500 text-sm">System is offline.</div>
          {systemStatus === "failed" && (
            <div className="text-red-400 text-xs">Previous launch failed. Check settings for logs.</div>
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
        
        {messages.map((msg, idx) => (
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
             onClick={() => setActiveTools(p => ({ ...p, search: !p.search }))}
             className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
               activeTools.search 
                 ? "bg-blue-600 text-white shadow-blue-900/50 shadow-sm" 
                 : "bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
             }`}
           >
             <span>{activeTools.search ? 'Web Search: ON' : 'Web Search: OFF'}</span>
           </button>
        </div>

        <form onSubmit={handleSend} className="relative flex gap-2">
          <VoiceInput onTranscript={handleVoiceTranscript} />
          <input
            autoFocus
            type="text"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-600"
            placeholder={readOnly ? "System is offline..." : "Type a message..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={readOnly || sending}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || sending || readOnly}
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
    </div>
  );
};
