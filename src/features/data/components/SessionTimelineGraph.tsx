import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle,
  Target,
  Lightbulb,
  Layers,
  FileText,
  AlertCircle,
  X,
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
    bgColor: 'bg-blue-900/30',
    label: 'Checkpoint',
  },
  event: {
    icon: Calendar,
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-300',
    bgColor: 'bg-purple-900/30',
    label: 'Event',
  },
  decision: {
    icon: Target,
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-300',
    bgColor: 'bg-orange-900/30',
    label: 'Decision',
  },
  insight: {
    icon: Lightbulb,
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-300',
    bgColor: 'bg-yellow-900/30',
    label: 'Insight',
  },
  pattern: {
    icon: Layers,
    color: 'bg-green-500',
    borderColor: 'border-green-500',
    textColor: 'text-green-300',
    bgColor: 'bg-green-900/30',
    label: 'Pattern',
  },
  file: {
    icon: FileText,
    color: 'bg-cyan-500',
    borderColor: 'border-cyan-500',
    textColor: 'text-cyan-300',
    bgColor: 'bg-cyan-900/30',
    label: 'File Change',
  },
};

export const SessionTimelineGraph: React.FC<SessionTimelineGraphProps> = ({ timeline }) => {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const getTitle = (event: TimelineEvent) => {
    const { type, data } = event;
    switch (type) {
      case 'checkpoint':
        return data.title || data.checkpoint_id || 'Checkpoint';
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

  const getDetailedContent = (event: TimelineEvent) => {
    const { type, data } = event;
    
    switch (type) {
      case 'checkpoint':
        return (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Title</div>
              <div className="text-sm text-blue-300">{data.title || 'Untitled'}</div>
            </div>
            {data.description && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Description</div>
                <div className="text-sm text-zinc-300">{data.description}</div>
              </div>
            )}
            {data.context && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Context</div>
                <div className="text-sm text-zinc-300 bg-zinc-900/50 p-2 rounded font-mono max-h-40 overflow-y-auto">
                  {JSON.stringify(data.context, null, 2)}
                </div>
              </div>
            )}
            {data.learned_memories && data.learned_memories.length > 0 && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Learned Memories ({data.learned_memories.length})</div>
                <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
                  {data.learned_memories.map((mem: string, idx: number) => (
                    <li key={idx}>{mem}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
        
      case 'event':
        return (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Event Type</div>
              <div className="text-sm text-purple-300">{data.event_type || 'Unknown'}</div>
            </div>
            {data.trigger && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Trigger</div>
                <div className="text-sm text-zinc-300">{data.trigger}</div>
              </div>
            )}
            {data.data && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Event Data</div>
                <div className="text-sm text-zinc-300 bg-zinc-900/50 p-2 rounded font-mono max-h-40 overflow-y-auto">
                  {typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2)}
                </div>
              </div>
            )}
          </div>
        );
        
      case 'decision':
        return (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Decision</div>
              <div className="text-sm text-orange-300">{data.decision || data.title || 'N/A'}</div>
            </div>
            {data.reasoning && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Reasoning</div>
                <div className="text-sm text-zinc-300">{data.reasoning}</div>
              </div>
            )}
            {data.alternatives && data.alternatives.length > 0 && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Alternatives Considered</div>
                <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
                  {data.alternatives.map((alt: any, idx: number) => (
                    <li key={idx}>{typeof alt === 'string' ? alt : JSON.stringify(alt)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
        
      case 'insight':
        return (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Insight</div>
              <div className="text-sm text-yellow-300">{data.insight || data.title || 'N/A'}</div>
            </div>
            {data.category && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Category</div>
                <div className="text-sm text-zinc-300">{data.category}</div>
              </div>
            )}
          </div>
        );
        
      case 'pattern':
        return (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Pattern</div>
              <div className="text-sm text-green-300">{data.pattern || data.title || 'N/A'}</div>
            </div>
            {data.frequency && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Frequency</div>
                <div className="text-sm text-zinc-300">{data.frequency}</div>
              </div>
            )}
          </div>
        );
        
      case 'file':
        return (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">File Path</div>
              <div className="text-sm text-cyan-300 font-mono">{data.file_path || data.name || 'N/A'}</div>
            </div>
            {data.change && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Change</div>
                <div className="text-sm text-zinc-300">{data.change}</div>
              </div>
            )}
            {data.reason && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Reason</div>
                <div className="text-sm text-zinc-300">{data.reason}</div>
              </div>
            )}
          </div>
        );
        
      default:
        return (
          <div className="text-sm text-zinc-300 bg-zinc-900/50 p-2 rounded font-mono max-h-60 overflow-y-auto">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        );
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

  // Reverse timeline to show oldest first (left) to newest (right)
  const sortedTimeline = [...timeline].reverse();

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Horizontal Timeline */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="relative min-w-max pb-4">
          {/* Horizontal timeline line */}
          <div className="absolute top-10 left-0 right-0 h-0.5 bg-zinc-700" />
          
          {/* Timeline events */}
          <div className="flex items-start gap-8">
            {/* Start marker */}
            <div className="flex flex-col items-center" style={{ minWidth: '100px' }}>
              <div className="w-4 h-4 rounded-full bg-zinc-700 border-2 border-zinc-900 mb-2" />
              <div className="text-xs text-zinc-500 text-center">Session Start</div>
            </div>

            {sortedTimeline.map((event, idx) => {
              const config = typeConfig[event.type];
              const Icon = config.icon;

              return (
                <div key={`timeline-${idx}`} className="flex flex-col items-center relative" style={{ minWidth: '200px', maxWidth: '200px' }}>
                  {/* Timeline node */}
                  <button
                    onClick={() => setSelectedEvent(event)}
                    className={`w-8 h-8 rounded-full ${config.color} border-2 border-zinc-900 flex items-center justify-center mb-2 hover:scale-110 transition-transform cursor-pointer z-10`}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </button>
                  
                  {/* Event card preview */}
                  <div
                    onClick={() => setSelectedEvent(event)}
                    className={`w-full rounded-lg border ${config.borderColor} ${config.bgColor} p-3 cursor-pointer hover:shadow-lg transition-shadow`}
                  >
                    <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${config.textColor}`}>
                      {config.label}
                    </div>
                    <div className={`text-sm font-medium ${config.textColor} truncate mb-1`}>
                      {getTitle(event)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatTime(event.timestamp)}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {formatDate(event.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* End marker */}
            <div className="flex flex-col items-center" style={{ minWidth: '100px' }}>
              <div className="w-4 h-4 rounded-full bg-green-600 border-2 border-zinc-900 mb-2" />
              <div className="text-xs text-green-500 text-center font-semibold">Latest</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Panel (slides in from bottom) */}
      {selectedEvent && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-end justify-center p-4 z-10">
          <div className="bg-zinc-900 rounded-lg border border-zinc-700 shadow-2xl w-full max-w-4xl max-h-[70vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`p-4 border-b border-zinc-800 flex items-center justify-between ${typeConfig[selectedEvent.type].bgColor}`}>
              <div className="flex items-center gap-3">
                {React.createElement(typeConfig[selectedEvent.type].icon, {
                  className: `w-6 h-6 ${typeConfig[selectedEvent.type].textColor}`,
                })}
                <div>
                  <div className={`text-lg font-semibold ${typeConfig[selectedEvent.type].textColor}`}>
                    {getTitle(selectedEvent)}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {formatDate(selectedEvent.timestamp)} at {formatTime(selectedEvent.timestamp)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {getDetailedContent(selectedEvent)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
