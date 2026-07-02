import React from 'react';
import { CheckCircle, Target, Lightbulb, Layers, FileText, Brain } from 'lucide-react';

interface SessionMetricsGridProps {
  checkpoints?: number;
  memories?: number;
  decisions?: number;
  files?: number;
  insights?: number;
  documents?: number;
}

export const SessionMetricsGrid: React.FC<SessionMetricsGridProps> = ({
  checkpoints = 0, memories = 0, decisions = 0, files = 0, insights = 0, documents = 0,
}) => {
  const metrics = [
    { icon: CheckCircle, label: 'Checkpoints', value: checkpoints, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Brain, label: 'Memories', value: memories, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: Target, label: 'Decisions', value: decisions, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { icon: Lightbulb, label: 'Insights', value: insights, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { icon: Layers, label: 'Files', value: files, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { icon: FileText, label: 'Documents', value: documents, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  ];

  return (
    <div className="grid grid-cols-6 gap-2">
      {metrics.map(m => {
        const Icon = m.icon;
        return (
          <div key={m.label} className={`${m.bg} rounded-lg p-3 text-center`}>
            <Icon className={`w-5 h-5 ${m.color} mx-auto mb-1`} />
            <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-zinc-500">{m.label}</div>
          </div>
        );
      })}
    </div>
  );
};
