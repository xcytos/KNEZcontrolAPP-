import React from 'react';
import { Loader2, CheckCircle, XCircle, Clock, Play, Square } from 'lucide-react';

type Status = 'idle' | 'thinking' | 'running' | 'success' | 'error' | 'stopped';

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  showIcon?: boolean;
}

const statusConfig: Record<Status, { icon: React.ReactNode; color: string; label: string }> = {
  idle: { icon: <Clock size={12} />, color: 'text-zinc-500', label: 'Idle' },
  thinking: { icon: <Loader2 size={12} className="animate-spin" />, color: 'text-amber-400', label: 'StatusIndicator-Thinking' },
  running: { icon: <Play size={12} />, color: 'text-blue-400', label: 'Running' },
  success: { icon: <CheckCircle size={12} />, color: 'text-green-400', label: 'Success' },
  error: { icon: <XCircle size={12} />, color: 'text-red-400', label: 'Error' },
  stopped: { icon: <Square size={12} />, color: 'text-zinc-400', label: 'Stopped' },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  showIcon = true,
}) => {
  const config = statusConfig[status];
  return (
    <div className={`flex items-center gap-1.5 ${config.color}`}>
      {showIcon && config.icon}
      <span className="text-xs font-medium">{label || config.label}</span>
    </div>
  );
};
