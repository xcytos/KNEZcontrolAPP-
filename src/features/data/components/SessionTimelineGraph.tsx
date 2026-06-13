import React from 'react';
import {
  Calendar,
  CheckCircle,
  Target,
  Lightbulb,
  Layers,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface TimelineEvent {
  type: 'checkpoint' | 'event' | 'decision' | 'insight' | 'pattern' | 'file';
  timestamp: string;
  data: any;
}

interface SessionTimelineGraphProps {
  timeline: TimelineEvent[];
}

const typeConfig = {
  checkpoint: {
    icon: CheckCircle,
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-300',
    bgColor: 'bg-blue-900/20',
    label: 'Checkpoint',
  },
  event: {
    icon: Calendar,
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-300',
    bgColor: 'bg-purple-900/20',
    label: 'Event',
  },
  decision: {
    icon: Target,
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-300',
    bgColor: 'bg-orange-900/20',
    label: 'Decision',
  },
  insight: {
    icon: Lightbulb,
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-300',
    bgColor: 'bg-yellow-900/20',
    label: 'Insight',
  },
  pattern: {
    icon: Layers,
    color: 'bg-green-500',
    borderColor: 'border-green-500',
    textColor: 'text-green-300',
    bgColor: 'bg-green-900/20',
    label: 'Pattern',
  },
  file: {
    icon: FileText,
    color: 'bg-cyan-500',
    borderColor: 'border-cyan-500',
    textColor: 'text-cyan-300',
    bgColor: 'bg-cyan-900/20',
    label: 'File Change',
  },
};

export const SessionTimelineGraph: React.FC<SessionTimelineGraphProps> = ({ timeline }) => {
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString();
    } catch {
      return dateStr;
    }
  };

  const getTitle = (event: TimelineEvent) => {
    const { type, data } = event;
    switch (type) {
      case 'checkpoint':
        return data.title || 'Checkpoint';
      case 'event':
        return data.event_type || 'Event';
      case 'decision':
        return data.decision || data.title || 'Decision';
      case 'insight':
        return data.insight || data.title || 'Insight';
      case 'pattern':
        return data.pattern || data.title || 'Pattern';
      case 'file':
        return data.file_path || data.name || 'File Change';
      default:
        return 'Unknown';
    }
  };

  const getSubtitle = (event: TimelineEvent) => {
    const { type, data } = event;
    switch (type) {
      case 'event':
        return data.trigger || '';
      case 'decision':
        return data.reasoning || '';
      case 'file':
        return data.change || data.operation || '';
      default:
        return '';
    }
  };

  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-zinc-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No timeline events to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto p-6">
      {/* Vertical timeline line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-zinc-700" />

      <div className="space-y-6">
        {timeline.map((event, idx) => {
          const config = typeConfig[event.type];
          const Icon = config.icon;

          return (
            <div key={`timeline-${idx}`} className="relative pl-16">
              {/* Timeline dot */}
              <div
                className={`absolute left-6 top-2 w-5 h-5 rounded-full ${config.color} border-2 border-zinc-900 flex items-center justify-center`}
              >
                <Icon className="w-3 h-3 text-white" />
              </div>

              {/* Event card */}
              <div
                className={`rounded-lg border ${config.borderColor} ${config.bgColor} overflow-hidden`}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wider ${config.textColor}`}
                        >
                          {config.label}
                        </span>
                      </div>
                      <h3 className={`font-medium text-sm ${config.textColor}`}>
                        {getTitle(event)}
                      </h3>
                      {getSubtitle(event) && (
                        <p className="text-xs text-zinc-400 mt-1">{getSubtitle(event)}</p>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 ml-4 text-right">
                      <div>{formatTime(event.timestamp)}</div>
                      <div className="mt-1 opacity-70">
                        {new Date(event.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Additional details */}
                  {event.data && Object.keys(event.data).length > 0 && (
                    <details className="mt-3">
                      <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-300">
                        View details
                      </summary>
                      <div className="mt-2 p-2 bg-zinc-900/50 rounded text-xs font-mono">
                        <pre className="text-zinc-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* End marker */}
      <div className="relative pl-16 mt-6">
        <div className="absolute left-6 top-0 w-5 h-5 rounded-full bg-zinc-700 border-2 border-zinc-900" />
        <div className="text-xs text-zinc-500 italic">End of timeline</div>
      </div>
    </div>
  );
};
