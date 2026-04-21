import React from 'react';
import { Button } from '../../../components/ui/core/Button';
import { Input } from '../../../components/ui/core/Input';
import { Send, Sparkles, Search, TerminalSquare, Loader2 } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  loading?: boolean;
  toolRunning?: boolean;
  onAgentAction?: (action: 'enhance' | 'search' | 'terminal') => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  loading = false,
  toolRunning = false,
  onAgentAction,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
    // Ctrl+Enter to send (alternative)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-t border-zinc-800 bg-zinc-900">
      {/* Tool Execution Status */}
      {toolRunning && (
        <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-900/20 px-3 py-2 rounded">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Tool execution in progress...</span>
        </div>
      )}

      {/* AI Agent Actions */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="xs"
          leftIcon={<Sparkles size={14} />}
          onClick={() => onAgentAction?.('enhance')}
          disabled={disabled}
        >
          Enhance
        </Button>
        <Button
          variant="secondary"
          size="xs"
          leftIcon={<Search size={14} />}
          onClick={() => onAgentAction?.('search')}
          disabled={disabled}
        >
          Search
        </Button>
        <Button
          variant="secondary"
          size="xs"
          leftIcon={<TerminalSquare size={14} />}
          onClick={() => onAgentAction?.('terminal')}
          disabled={disabled}
        >
          Terminal
        </Button>
      </div>

      {/* Main Input */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={disabled || loading}
          />
        </div>
        <Button
          variant="primary"
          onClick={onSend}
          disabled={disabled || loading || toolRunning || !value.trim()}
          leftIcon={loading || toolRunning ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          loading={loading || toolRunning}
        >
          Send
        </Button>
      </div>
    </div>
  );
};
