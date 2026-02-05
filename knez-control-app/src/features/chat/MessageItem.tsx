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
      className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"} group relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
      data-testid="message-bubble"
      data-role={msg.from}
      className={`max-w-[85%] rounded-lg p-4 ${
          msg.from === "user"
            ? "bg-blue-600/20 border border-blue-500/30 text-blue-100"
            : msg.refusal
              ? "bg-red-900/20 border border-red-800 text-red-200"
              : "bg-zinc-800 border border-zinc-700 text-zinc-300"
        }`}
      >
        {/* Content Rendering */}
        {parts.map((part, i) => {
          if (part.type === 'think') {
             return (
               <div key={i} className="mb-3 border-l-2 border-zinc-600 pl-3">
                 <button 
                   onClick={() => setThoughtsOpen(!thoughtsOpen)}
                   className="text-xs font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-2 mb-1"
                 >
                   {thoughtsOpen ? '▼' : '▶'} Thought Process
                 </button>
                 {thoughtsOpen && (
                   <div className="text-zinc-500 text-sm italic whitespace-pre-wrap bg-black/20 p-2 rounded">
                     {part.content}
                   </div>
                 )}
               </div>
             );
          }
          return <FormattedContent key={i} text={part.content} />;
        })}

        {msg.isPartial && <span className="inline-block w-2 h-4 ml-1 bg-zinc-500 animate-pulse align-middle" />}

        {/* Metadata Footer */}
        <div className="mt-2 flex items-center justify-between gap-4 border-t border-white/5 pt-2 min-h-[24px]">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 opacity-70" title={new Date(msg.createdAt).toISOString()}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            
            {/* CP3-G: Enhanced Metadata */}
            {msg.from === 'knez' && msg.metrics && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
                {msg.isPartial ? (
                  <span className="text-blue-400 animate-pulse">GENERATING...</span>
                ) : (
                  <>
                    <span title="Time to First Token">TTFT: {msg.metrics.timeToFirstTokenMs ?? '-'}ms</span>
                    <span title="Total Tokens">TOK: {msg.metrics.totalTokens ?? '-'}</span>
                    {msg.metrics.timeToFirstTokenMs && msg.metrics.totalTokens && (
                       <span title="Tokens per second">
                         {((msg.metrics.totalTokens / ((Date.now() - new Date(msg.createdAt).getTime())/1000)).toFixed(1))} t/s
                       </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className={`flex items-center gap-2 transition-opacity ${isHovered || copied ? 'opacity-100' : 'opacity-0'}`}>
            <button 
              onClick={handleCopy}
              className="text-zinc-500 hover:text-white text-xs"
              title="Copy message"
            >
              {copied ? '✓' : 'Copy'}
            </button>
            
            {msg.from === "knez" && !msg.isPartial && (
              <>
                <button
                  onClick={() => onVote(msg.id, "upvote")}
                  disabled={readOnly}
                  className={`p-1 hover:bg-zinc-700 rounded ${msg.influence?.vote === "upvote" ? "text-green-400" : "text-zinc-600"}`}
                >
                  👍
                </button>
                <button
                  onClick={() => onVote(msg.id, "downvote")}
                  disabled={readOnly}
                  className={`p-1 hover:bg-zinc-700 rounded ${msg.influence?.vote === "downvote" ? "text-red-400" : "text-zinc-600"}`}
                >
                  👎
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
