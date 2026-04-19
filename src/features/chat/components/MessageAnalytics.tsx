import React from 'react';
import { Card } from '../../../components/ui/core/Card';
import { Badge } from '../../../components/ui/core/Badge';
import { Zap } from 'lucide-react';

interface MessageAnalyticsProps {
  metrics?: {
    timeToFirstTokenMs?: number;
    responseTimeMs?: number;
    totalTokens?: number;
    toolExecutionTime?: number;
    fallbackTriggered?: boolean;
  };
}

export const MessageAnalytics: React.FC<MessageAnalyticsProps> = ({ metrics }) => {
  if (!metrics) return null;

  const formatTime = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={14} className="text-zinc-400" />
        <span className="text-xs font-medium text-zinc-300">Performance Metrics</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">TTFT</span>
          <span className="font-mono text-zinc-300">{formatTime(metrics.timeToFirstTokenMs)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">Response</span>
          <span className="font-mono text-zinc-300">{formatTime(metrics.responseTimeMs)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">Tokens</span>
          <span className="font-mono text-zinc-300">{metrics.totalTokens ?? '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">Tool Time</span>
          <span className="font-mono text-zinc-300">{formatTime(metrics.toolExecutionTime)}</span>
        </div>
      </div>
      {metrics.fallbackTriggered && (
        <div className="mt-2">
          <Badge variant="warning" className="text-[10px]">
            Fallback Triggered
          </Badge>
        </div>
      )}
    </Card>
  );
};
