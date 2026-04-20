import React, { useMemo, useState } from 'react';
import { ChatMessage } from '../../domain/DataContracts';
import { AgentTrace } from '../../services/agent/AgentTracer';
import { parseMessageContent, formatMarkdown, copyToClipboard } from './ChatUtils';

const CodeBlock: React.FC<{ language: string; content: string }> = ({ language, content }) => {
  const [copied, setCopied] = useState(false);
  // [FIX #7] Manual code execution disabled per MCP protocol
  // Code execution should only happen through chat requests

  const handleCopy = () => {
    copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-md overflow-hidden bg-zinc-950 border border-zinc-800">
      <div className="flex justify-between items-center px-3 py-1 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">{language}</span>
        <div className="flex items-center gap-3">
          {/* [FIX #7] Manual execution removed per MCP protocol */}
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
  agentTrace?: AgentTrace;
}> = ({ msg, readOnly, onStop, onRetry, onEdit, agentTrace }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [thoughtsOpen, setThoughtsOpen] = useState(false);
  const [toolDetailsOpen, setToolDetailsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const parts = parseMessageContent(msg.text);
  // const hasThink = parts.some(p => p.type === 'think');

  // [FIX D1/C3] — Guard: never render raw tool_call JSON blobs to the user.
  // If the text is ONLY a {"tool_call":...} payload with no toolCall metadata,
  // it means the execution loop leaked internal JSON. Show execution state instead.
  const isRawToolCallJson = useMemo(() => {
    if (msg.toolCall) return false; // already handled by toolCall renderer below
    if (msg.from === 'user') return false;
    const t = String(msg.text ?? '').trim();
    if (!t.startsWith('{')) return false;
    try {
      const obj = JSON.parse(t);
      return obj && typeof obj === 'object' && 'tool_call' in obj;
    } catch {
      return false;
    }
  }, [msg.text, msg.toolCall, msg.from]);

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
      {/* Avatar for Assistant - hide for tool_execution to merge with response */}
      {msg.from !== "user" && (msg.from as string) !== 'tool_execution' && (
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
              : (msg.from as string) === 'tool_execution'
                ? "bg-transparent text-zinc-300 pl-0 pt-0 w-full max-w-full" // Transparent and full width for tool execution
                : "bg-transparent text-zinc-300 pl-0 pt-0" // Transparent for assistant (Claude style)
        }`}
      >
        {/* Header Label - hide for tool_execution to merge with response */}
        {(msg.from as string) !== 'tool_execution' && (
          <div className="text-xs font-bold text-zinc-500 mb-1">
             {(msg.from as string) === 'user' ? 'You' :
              (msg.from as string) === 'assistant' || (msg.from as string) === 'knez' ? 'Assistant' :
              (msg.from as string) === 'tool_result' ? 'Tool Result' :
              (msg.from as string) === 'system' ? 'System' : 'Assistant'}
          </div>
        )}

        {/* Execution Group Header - show for multi-step executions */}
        {msg.toolCall?.pattern === "multi_step" && msg.toolCall?.sequenceOrder === 0 && (
          <div className="text-[10px] font-mono text-zinc-500 mb-2 flex items-center gap-2">
            <span className="text-zinc-400">▶</span>
            <span>Execution Cycle</span>
            {msg.toolCall.groupingId && (
              <span className="text-zinc-600">#{msg.toolCall.groupingId.slice(-4)}</span>
            )}
          </div>
        )}

        {/* Content Rendering - Correct Order: Thoughts → Tools → Response */}
        {parts.map((part, i) => {
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
          // Regular text content - will be rendered after tool execution
          return null;
        })}

        {/* Tool Execution Block - Rendered after thoughts, before response text */}
        {msg.toolCall ? (
          <div className="border border-zinc-800 bg-zinc-950/60 rounded-lg p-3">
            <button
              onClick={() => setToolDetailsOpen(!toolDetailsOpen)}
              className="w-full flex items-center justify-between mb-2 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-200 break-all min-w-0">
                  MCP: {msg.toolCall.tool}
                </span>
                {msg.toolCall.phase && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    msg.toolCall.phase === "execution"
                      ? "bg-purple-900/20 text-purple-300 border-purple-900/40"
                      : msg.toolCall.phase === "planning"
                        ? "bg-cyan-900/20 text-cyan-300 border-cyan-900/40"
                        : msg.toolCall.phase === "post_execution"
                          ? "bg-orange-900/20 text-orange-300 border-orange-900/40"
                          : "bg-zinc-900/20 text-zinc-400 border-zinc-900/40"
                  }`}>
                    {msg.toolCall.phase.toUpperCase()}
                  </span>
                )}
                <span className="text-[10px] text-zinc-500">
                  {toolDetailsOpen ? '▼' : '▶'}
                </span>
              </div>
              <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                msg.toolCall.status === "pending"
                  ? "bg-yellow-900/20 text-yellow-300 border-yellow-900/40"
                  : msg.toolCall.status === "running"
                    ? "bg-blue-900/20 text-blue-200 border-blue-900/40 animate-pulse"
                    : msg.toolCall.status === "calling"
                      ? "bg-blue-900/20 text-blue-200 border-blue-900/40"
                      : msg.toolCall.status === "succeeded" || msg.toolCall.status === "completed"
                        ? "bg-green-900/20 text-green-300 border-green-900/40"
                        : msg.toolCall.status === "failed"
                          ? "bg-red-900/20 text-red-300 border-red-900/40"
                          : "bg-zinc-900/20 text-zinc-300 border-zinc-900/40"
              }`}>
                {msg.toolCall.status === "pending" ? "pending" :
                 msg.toolCall.status === "running" ? "running" :
                 msg.toolCall.status === "calling" ? "executing" :
                 msg.toolCall.status === "completed" ? "completed" :
                 msg.toolCall.status}
              </div>
            </button>
            {toolDetailsOpen && (
              <div className="mt-3 space-y-3">
                {msg.toolCall.executionTimeMs && (
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>Execution Time</span>
                    <span className="text-zinc-300">{msg.toolCall.executionTimeMs}ms</span>
                  </div>
                )}
                {msg.toolCall.mcpLatencyMs && (
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>MCP Latency</span>
                    <span className="text-zinc-300">{msg.toolCall.mcpLatencyMs}ms</span>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 mb-1">REQUEST</div>
                  <div className="max-w-full overflow-x-auto">
                    <pre className="text-[10px] text-zinc-300 bg-zinc-900/50 p-2 rounded border border-zinc-800 whitespace-pre-wrap break-all word-break-all">
                      {JSON.stringify(msg.toolCall.args, null, 2)}
                    </pre>
                  </div>
                </div>
                {msg.toolCall.status === "succeeded" && msg.toolCall.result !== undefined && (
                  <div>
                    <div className="text-[10px] font-mono text-zinc-500 mb-1">OUTPUT</div>
                    <div className="max-w-full overflow-x-auto">
                      <pre className="text-[10px] text-zinc-300 bg-zinc-900/50 p-2 rounded border border-zinc-800 whitespace-pre-wrap break-all word-break-all">
                        {typeof msg.toolCall.result === 'string' ? msg.toolCall.result : JSON.stringify(msg.toolCall.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                {msg.toolCall.status === "failed" && msg.toolCall.error && (
                  <div>
                    <div className="text-[10px] font-mono text-red-400 mb-1">ERROR</div>
                    <div className="max-w-full overflow-x-auto">
                      <pre className="text-[10px] text-red-300 bg-red-900/10 p-2 rounded border border-red-900/30 whitespace-pre-wrap break-all word-break-all">
                        {msg.toolCall.error}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isRawToolCallJson ? (
          // [FIX D1/D2] — Raw tool call JSON leaked through; show execution state, not JSON
          <div className="border border-zinc-800 bg-zinc-950/60 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-mono text-zinc-200 break-all min-w-0">MCP Tool Execution</div>
              <div className="text-[10px] font-mono px-2 py-0.5 rounded border bg-blue-900/20 text-blue-200 border-blue-900/40">
                executing
              </div>
            </div>
            <div className="text-xs text-blue-200">⚡ Executing...</div>
          </div>
        ) : null}

        {/* Response Text - Rendered after tool execution */}
        {parts.map((part, i) => {
          if (part.type === 'think' || part.type === 'system') {
            return null; // Already rendered above
          }
          return <FormattedContent key={i} text={part.content} />;
        })}

        {/* P6.2 T9: Execution Timeline */}
        {agentTrace && agentTrace.steps.length > 0 && (
          <div className="mt-3 border border-zinc-800 bg-zinc-950/60 rounded-lg p-3">
            <button
              onClick={() => setTimelineOpen(!timelineOpen)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-xs font-medium text-zinc-300">⏱️ Execution Timeline ({agentTrace.steps.length} steps)</span>
              <span className="text-[10px] text-zinc-500">{timelineOpen ? '▼' : '▶'}</span>
            </button>
            {timelineOpen && (
              <div className="mt-3 space-y-2">
                {agentTrace.steps.map((step, idx) => (
                  <div key={idx} className="pl-3 border-l-2 border-zinc-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-zinc-400">Step {step.stepNumber + 1}</span>
                      {step.timing.duration > 0 && (
                        <span className="text-[10px] text-zinc-500">{step.timing.duration}ms</span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-300 mb-1">{step.decision}</div>
                    {step.retry && (
                      <div className="text-[10px] text-yellow-400 flex items-center gap-1">
                        🔄 Retry {step.retry.attempt}
                      </div>
                    )}
                    {step.failure && (
                      <div className="text-[10px] text-red-400 flex items-center gap-1">
                        ❌ {step.failure.type}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
           {msg.isPartial && msg.from !== "user" && !msg.hasReceivedFirstToken && (
             <span data-testid="delivery-status" data-status="pending" className="text-[10px] text-zinc-400 flex items-center gap-1.5">
               <span className="flex gap-0.5 items-center">
                 <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                 <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                 <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
               </span>
               Typing...
             </span>
           )}
           {msg.metrics?.totalTokens !== undefined && (msg.metrics.totalTokens ?? 0) > 0 && (
             <span className="text-[10px] font-mono bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800">
               {msg.metrics.totalTokens} tokens
               {msg.metrics.timeToFirstTokenMs && ` · ${(msg.metrics.timeToFirstTokenMs/1000).toFixed(1)}s latency`}
             </span>
           )}
           {msg.metrics?.responseTimeMs !== undefined && !msg.isPartial && (
             <span className="text-[10px] font-mono bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-400" title="Full response time">
              {msg.metrics.responseTimeMs < 1000
                ? `${msg.metrics.responseTimeMs}ms`
                : msg.metrics.responseTimeMs < 60000
                  ? `${(msg.metrics.responseTimeMs / 1000).toFixed(1)}s`
                  : `${Math.floor(msg.metrics.responseTimeMs / 60000)}m ${Math.floor((msg.metrics.responseTimeMs % 60000) / 1000)}s`}
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
