import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader, X, Sparkles, Brain, AlertCircle, Square } from 'lucide-react';
import { knezClient } from '../../services/knez/KnezClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface TaqwinAgentPanelProps {
  sessionId?: string;
  projectId?: string;
  onClose?: () => void;
}

export const TaqwinAgentPanel: React.FC<TaqwinAgentPanelProps> = ({
  sessionId,
  projectId,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to TAQWIN Agent! I\'m ready to chat using the KNEZ AI backend. Ask me anything!',
      timestamp: new Date(),
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);
    
    const controller = new AbortController();
    abortRef.current = controller;
    
    try {
      const systemPrompt = `You are TAQWIN Agent, an AI assistant specializing in TAQWIN memory system analysis.

CAPABILITIES:
- Answer questions about TAQWIN sessions, projects, checkpoints, and documents
- Analyze session hierarchies and knowledge evolution
- Help developers understand their development history
- Provide insights from learned memories and decisions

CONTEXT:
${sessionId ? `Current Session: ${sessionId}` : 'Dashboard Overview Mode'}
${projectId ? `Current Project: ${projectId}` : 'Multi-project view'}

TONE:
- Technical and precise
- Reference specific session IDs, checkpoint IDs when relevant
- Use data-driven insights`;

      const messagesForStream = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userMessage.content },
      ];
      
      let accumulatedContent = '';
      
      const stream = knezClient.chatCompletionsStream(
        messagesForStream,
        sessionId || 'dashboard-agent',
        { signal: controller.signal }
      );
      
      for await (const chunk of stream) {
        if (controller.signal.aborted) break;
        accumulatedContent += chunk;
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantId 
              ? { ...m, content: accumulatedContent } 
              : m
          )
        );
      }
      
      if (!accumulatedContent && !controller.signal.aborted) {
        throw new Error('No response received from KNEZ backend');
      }
      
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const errorMsg = err?.message || String(err);
      setError(errorMsg);
      
      setMessages(prev => {
        const hasAssistant = prev.some(m => m.id === assistantId);
        if (hasAssistant) {
          return prev.map(m => 
            m.id === assistantId 
              ? { ...m, content: `❌ Error: ${errorMsg}` } 
              : m
          );
        } else {
          return [...prev, {
            id: assistantId,
            role: 'assistant',
            content: `❌ Error: ${errorMsg}`,
            timestamp: new Date(),
          }];
        }
      });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isLoading) {
        handleStop();
      } else {
        handleSend();
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold text-zinc-100">TAQWIN Agent</h2>
          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-full font-mono">
            KNEZ + Ollama
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Context Info */}
      {(sessionId || projectId) && (
        <div className="px-4 py-2 bg-zinc-900/30 border-b border-zinc-800">
          <div className="text-xs text-zinc-500">
            {sessionId && (
              <div className="font-mono">Session: {sessionId.slice(0, 8)}</div>
            )}
            {projectId && (
              <div className="font-mono">Project: {projectId}</div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-100'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </div>
              <div className={`text-[10px] mt-1 ${
                message.role === 'user' ? 'text-blue-200' : 'text-zinc-500'
              }`}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-sm text-zinc-400">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-t border-red-800/50 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask TAQWIN Agent..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          {isLoading ? (
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Powered by KNEZ + Ollama
        </div>
      </div>
    </div>
  );
};
