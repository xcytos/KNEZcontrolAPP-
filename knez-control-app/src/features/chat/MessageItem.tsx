import React, { useMemo, useState } from 'react';
import { ChatMessage } from '../../domain/DataContracts';
import { parseMessageContent, formatMarkdown, copyToClipboard } from './ChatUtils';

const CodeBlock: React.FC<{ language: string; content: string }> = ({ language, content }) => {
  const [copied, setCopied] = useState(false);
  const isTauri = useMemo(() => {
    const w = window as any;
    return !!(w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__ ?? w.__TAURI_IPC__);
  }, []);
  const canRun = useMemo(() => {
    const lang = String(language || "").toLowerCase().trim();
    if (!lang) return false;
    return ["sh", "bash", "shell", "cmd", "bat", "powershell", "ps1", "pwsh"].includes(lang);
  }, [language]);

  const handleCopy = () => {
    copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    try {
      window.dispatchEvent(new CustomEvent("knez-terminal-run", { detail: { command: content, source: "codeblock" } }));
    } catch {}
  };

  return (
    <div className="my-2 rounded-md overflow-hidden bg-zinc-950 border border-zinc-800">
      <div className="flex justify-between items-center px-3 py-1 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">{language}</span>
        <div className="flex items-center gap-3">
          {canRun && (
            <button
              onClick={handleRun}
              disabled={!isTauri}
              className="text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={isTauri ? "Send to in-chat terminal" : "Requires desktop app (Tauri)"}
            >
              Run
            </button>
          )}
          <button 
            onClick={handleCopy}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="p-3 overflow-x-hidden text-xs font-mono text-zinc-300 whitespace-pre-wrap break-words max-w-full">
        <code className="whitespace-pre-wrap break-words">{content}</code>
      </pre>
    </div>
  );
};

const MarkdownText: React.FC<{ content: string }> = ({ content }) => {
  // Simple inline formatting for bold/italic
  const parts = content.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold text-zinc-200">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} className="italic text-zinc-400">{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </span>
  );
};

const FormattedContent: React.FC<{ text: string }> = ({ text }) => {
  const blocks = formatMarkdown(text);
  
  return (
    <div className="whitespace-pre-wrap leading-relaxed break-words max-w-full min-w-0">
      {blocks.map((block, i) => (
        block.type === 'code' ? (
          <CodeBlock key={i} language={block.language!} content={block.content} />
        ) : (
          <MarkdownText key={i} content={block.content} />
        )
      ))}
    </div>
  );
};

const MessageItemInner: React.FC<{ 
  msg: ChatMessage; 
  readOnly: boolean;
  onStop?: (id: string) => void;
  onRetry?: (id: string) => void;
  onEdit?: (id: string) => void;
}> = ({ msg, readOnly, onStop, onRetry, onEdit }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [thoughtsOpen, setThoughtsOpen] = useState(false);

  const parts = parseMessageContent(msg.text);
  // const hasThink = parts.some(p => p.type === 'think');

  const handleCopy = () => {
    copyToClipboard(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"} group relative mb-6`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar for Assistant */}
      {msg.from !== "user" && (
         <div className="w-8 h-8 rounded-full bg-indigo-900/50 flex items-center justify-center border border-indigo-700/50 mr-3 mt-1 shrink-0 text-xs font-bold text-indigo-200">
            K
         </div>
      )}

      <div
      data-testid="message-bubble"
      data-role={msg.from}
      data-message-id={msg.id}
      className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
          msg.from === "user"
            ? "bg-zinc-800 text-zinc-100 rounded-tr-sm"
            : msg.refusal
              ? "bg-red-900/10 border border-red-900/30 text-red-200 rounded-tl-sm"
              : "bg-transparent text-zinc-300 pl-0 pt-0" // Transparent for assistant (Claude style)
        }`}
      >
        {/* Header Label */}
        <div className="text-xs font-bold text-zinc-500 mb-1">
           {msg.from === 'user' ? 'You' : 'Assistant'}
        </div>

        {/* Content Rendering */}
        {msg.toolCall ? (
          <div className="border border-zinc-800 bg-zinc-950/60 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-mono text-zinc-200 break-all min-w-0">{msg.toolCall.tool}</div>
              <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                msg.toolCall.status === "succeeded"
                  ? "bg-green-900/20 text-green-300 border-green-900/40"
                  : msg.toolCall.status === "failed"
                    ? "bg-red-900/20 text-red-300 border-red-900/40"
                    : "bg-blue-900/20 text-blue-200 border-blue-900/40"
              }`}>
                {msg.toolCall.status}
              </div>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mb-1">args</div>
            <pre className="text-[10px] bg-zinc-950 p-2 rounded overflow-x-hidden whitespace-pre-wrap break-words text-zinc-300 border border-zinc-900 max-w-full">
              {JSON.stringify(msg.toolCall.args ?? {}, null, 2)}
            </pre>
            {msg.toolCall.status !== "calling" && (
              <>
                <div className="text-[10px] font-mono text-zinc-500 mt-3 mb-1">
                  {msg.toolCall.status === "failed" ? "error" : "result"}
                </div>
                <pre className={`text-[10px] bg-zinc-950 p-2 rounded overflow-x-hidden whitespace-pre-wrap break-words border border-zinc-900 max-w-full ${
                  msg.toolCall.status === "failed" ? "text-red-300" : "text-green-300"
                }`}>
                  {msg.toolCall.status === "failed"
                    ? String(msg.toolCall.error ?? "unknown error")
                    : JSON.stringify(msg.toolCall.result ?? {}, null, 2)}
                </pre>
              </>
            )}
          </div>
        ) : (
          parts.map((part, i) => {
            if (part.type === 'think') {
               return (
                 <div key={i} className="mb-3 pl-3 border-l-2 border-indigo-500/30">
                   <button 
                     onClick={() => setThoughtsOpen(!thoughtsOpen)}
                     className="text-xs font-medium text-indigo-400/70 hover:text-indigo-300 flex items-center gap-2 mb-1 transition-colors"
                   >
                     {thoughtsOpen ? 'Hide' : 'Show'} Thought Process
                   </button>
                   {thoughtsOpen && (
                     <div className="text-zinc-500 text-sm italic whitespace-pre-wrap bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                       {part.content}
                     </div>
                   )}
                 </div>
               );
            }
            if (part.type === "system") {
              const title = (part as any).title ?? "SYSTEM";
              const content = part.content ?? "";
              return (
                <div key={i} className="my-3 rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                    <div className="text-[10px] font-mono text-zinc-400">{title}</div>
                    <button
                      type="button"
                      onClick={() => {
                        void copyToClipboard(content);
                      }}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300"
                      title="Copy"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-[10px] text-zinc-300 p-3 overflow-x-hidden whitespace-pre-wrap break-words max-w-full">
                    {content}
                  </pre>
                </div>
              );
            }
            return <FormattedContent key={i} text={part.content} />;
          })
        )}
        
        {msg.isPartial && <span data-testid="partial-cursor" className="inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse align-middle" />}

        {/* Metadata Footer */}
        <div className={`flex items-center gap-3 mt-2 ${msg.from === "user" ? "justify-end opacity-50 text-zinc-400" : "justify-start text-zinc-500"}`}>
           {msg.deliveryStatus === "queued" && (
             <span data-testid="delivery-status" data-status="queued" className="text-[10px] font-mono bg-zinc-900/50 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-800" title={msg.deliveryError || "queued"}>
               queued
             </span>
           )}
           {msg.deliveryStatus === "pending" && (
             <span data-testid="delivery-status" data-status="pending" className="text-[10px] font-mono bg-blue-900/20 text-blue-200 px-1.5 py-0.5 rounded border border-blue-900/40">
               pending
             </span>
           )}
           {msg.deliveryStatus === "failed" && (
             <span data-testid="delivery-status" data-status="failed" className="text-[10px] font-mono bg-red-900/20 text-red-200 px-1.5 py-0.5 rounded border border-red-900/40" title={msg.deliveryError || "delivery failed"}>
               failed
             </span>
           )}
           {msg.metrics?.finishReason === "stopped" && (
             <span data-testid="finish-reason" data-reason="stopped" className="text-[10px] font-mono bg-amber-900/20 text-amber-200 px-1.5 py-0.5 rounded border border-amber-900/40">
               stopped
             </span>
           )}
           {msg.metrics?.modelId && (
             <span className="text-[10px] font-mono bg-zinc-900/50 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-800">
               {msg.metrics.modelId}
             </span>
           )}
           {msg.isPartial && msg.from !== "user" && (msg.metrics?.totalTokens ?? 0) === 0 && (
             <span className="text-[10px] font-mono bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800">
               waiting for response
             </span>
           )}
           {msg.metrics?.totalTokens !== undefined && (!msg.isPartial || (msg.metrics.totalTokens ?? 0) > 0) && (
             <span className="text-[10px] font-mono bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800">
               {msg.metrics.totalTokens} tokens
               {msg.metrics.timeToFirstTokenMs && ` · ${(msg.metrics.timeToFirstTokenMs/1000).toFixed(1)}s latency`}
             </span>
           )}
           
           {(isHovered || copied) && (
              <div className="flex items-center gap-2 transition-opacity duration-200">
                 <button onClick={handleCopy} className="text-[10px] hover:text-zinc-300 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors" title="Copy">
                    {copied ? "Copied" : "Copy"}
                 </button>
                 {!readOnly && (
                    <>
                      {msg.from === "user" && onEdit && (
                        <button 
                          onClick={() => onEdit(msg.id)} 
                          className="text-[10px] hover:text-blue-400 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {msg.from !== "user" && (
                        <>
                          {(msg.isPartial || msg.deliveryStatus === "pending" || msg.deliveryStatus === "queued") && onStop && (
                            <button 
                              onClick={() => onStop(msg.id)} 
                              className="text-[10px] hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors"
                            >
                              Stop
                            </button>
                          )}
                          {(msg.deliveryStatus === "failed" || msg.metrics?.finishReason === "stopped") && onRetry && (
                            <button 
                              onClick={() => onRetry(msg.id)} 
                              className="text-[10px] hover:text-blue-400 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors"
                            >
                              Retry
                            </button>
                          )}
                        </>
                      )}
                    </>
                 )}
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export const MessageItem = React.memo(MessageItemInner);
