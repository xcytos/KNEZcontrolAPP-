import React, { useState } from 'react';
import { ChatMessage } from '../../domain/DataContracts';
import { parseMessageContent, formatMarkdown, copyToClipboard } from './ChatUtils';

const CodeBlock: React.FC<{ language: string; content: string }> = ({ language, content }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-md overflow-hidden bg-zinc-950 border border-zinc-800">
      <div className="flex justify-between items-center px-3 py-1 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">{language}</span>
        <button 
          onClick={handleCopy}
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono text-zinc-300">
        <code>{content}</code>
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
    <div className="whitespace-pre-wrap leading-relaxed">
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

export const MessageItem: React.FC<{ 
  msg: ChatMessage; 
  readOnly: boolean;
  onVote: (id: string, vote: "upvote" | "downvote") => void;
}> = ({ msg, readOnly, onVote }) => {
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
          return <FormattedContent key={i} text={part.content} />;
        })}
        
        {msg.isPartial && <span className="inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse align-middle" />}

        {/* Metadata Footer */}
        <div className={`flex items-center gap-3 mt-2 ${msg.from === "user" ? "justify-end opacity-50 text-zinc-400" : "justify-start text-zinc-500"}`}>
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
                      <button onClick={() => onVote(msg.id, "upvote")} className="text-[10px] hover:text-green-400 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors" title="Good">Upvote</button>
                      <button onClick={() => onVote(msg.id, "downvote")} className="text-[10px] hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors" title="Bad">Downvote</button>
                    </>
                 )}
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
