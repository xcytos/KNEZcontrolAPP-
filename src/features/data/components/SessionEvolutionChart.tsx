import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle,
  Target,
  Lightbulb,
  Layers,
  FileText,
  Brain,
  Activity,
  X,
  Clock,
  Calendar,
} from 'lucide-react';
import { DocumentViewer } from './DocumentViewer';
import { Document } from './DocumentList';

interface TimelineEvent {
  type: 'checkpoint' | 'event' | 'decision' | 'insight' | 'pattern' | 'file' | 'document';
  timestamp: string;
  data: any;
}

interface SessionEvolutionChartProps {
  timeline: TimelineEvent[];
  sessionStart: string;
  sessionEnd: string;
}

export const SessionEvolutionChart: React.FC<SessionEvolutionChartProps> = ({
  timeline,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);

  // Auto-expand when event is selected - for ALL event types
  useEffect(() => {
    if (!selectedEvent) {
      // Reset when no event selected
    }
  }, [selectedEvent]);

  // Sort timeline by timestamp (newest first for vertical display)
  const sortedTimeline = useMemo(() => {
    return [...timeline].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [timeline]);

  // Get event color and icon
  const getEventColor = (type: string) => {
    switch (type) {
      case 'checkpoint':
        return { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-400' };
      case 'decision':
        return { bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-400' };
      case 'insight':
        return { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-400' };
      case 'pattern':
        return { bg: 'bg-green-500', border: 'border-green-400', text: 'text-green-400' };
      case 'file':
        return { bg: 'bg-cyan-500', border: 'border-cyan-400', text: 'text-cyan-400' };
      case 'document':
        return { bg: 'bg-pink-500', border: 'border-pink-400', text: 'text-pink-400' };
      case 'event':
        return { bg: 'bg-purple-500', border: 'border-purple-400', text: 'text-purple-400' };
      default:
        return { bg: 'bg-zinc-500', border: 'border-zinc-400', text: 'text-zinc-400' };
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'checkpoint':
        return CheckCircle;
      case 'decision':
        return Target;
      case 'insight':
        return Lightbulb;
      case 'pattern':
        return Layers;
      case 'file':
        return FileText;
      case 'document':
        return FileText;
      default:
        return Activity;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      // Convert to Indian Standard Time (IST = UTC+5:30)
      return {
        time: date.toLocaleTimeString('en-IN', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        }),
        date: date.toLocaleDateString('en-IN', { 
          month: 'short', 
          day: 'numeric',
          timeZone: 'Asia/Kolkata'
        }),
        full: date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      };
    } catch {
      return { time: '', date: '', full: dateStr };
    }
  };

  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="text-center text-zinc-400">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No session evolution data</p>
        </div>
      </div>
    );
  }

  // Calculate session metrics
  const metrics = useMemo(() => {
    const checkpoints = sortedTimeline.filter(e => e.type === 'checkpoint').length;
    
    // Count all decisions from timeline
    let decisionsCount = 0;
    sortedTimeline.forEach(e => {
      if (e.type === 'checkpoint' && e.data?.decisions) {
        let decisions = e.data.decisions;
        if (typeof decisions === 'string') {
          try {
            decisions = JSON.parse(decisions);
          } catch (err) {
            // ignore
          }
        }
        if (Array.isArray(decisions)) {
          decisionsCount += decisions.length;
        }
      } else if (e.type === 'decision') {
        decisionsCount++;
      }
    });
    
    // Count all file changes from timeline
    let filesCount = 0;
    sortedTimeline.forEach(e => {
      if (e.type === 'file') {
        filesCount++;
      } else if (e.type === 'event' && e.data?.content) {
        let content = e.data.content;
        if (typeof content === 'string') {
          try {
            content = JSON.parse(content);
          } catch (err) {
            // ignore
          }
        }
        if (content?.data?.files && Array.isArray(content.data.files)) {
          filesCount += content.data.files.length;
        }
      }
    });
    
    const insights = sortedTimeline.filter(e => e.type === 'insight' || e.type === 'pattern').length;
    
    // Count total learned memories
    let learnedCount = 0;
    sortedTimeline.forEach(e => {
      if (e.type === 'checkpoint' && e.data?.learned_memories) {
        let memories = e.data.learned_memories;
        if (typeof memories === 'string') {
          try {
            memories = JSON.parse(memories);
          } catch (err) {
            // ignore
          }
        }
        if (Array.isArray(memories)) {
          learnedCount += memories.length;
        }
      }
    });

    return { checkpoints, decisions: decisionsCount, files: filesCount, insights, learnedCount };
  }, [sortedTimeline]);

  return (
    <div className="relative h-full flex flex-col bg-zinc-950">
      {/* Metrics Ribbon */}
      <div className="flex items-stretch border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        <div className="flex-1 px-4 py-3 border-r border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
          <div className="text-2xl font-bold text-blue-400">{metrics.learnedCount}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mt-0.5">Learned Memories</div>
        </div>
        
        <div className="flex-1 px-4 py-3 border-r border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
          <div className="text-2xl font-bold text-orange-400">{metrics.decisions}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mt-0.5">Decisions Made</div>
        </div>
        
        <div className="flex-1 px-4 py-3 border-r border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
          <div className="text-2xl font-bold text-cyan-400">{metrics.files}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mt-0.5">Files Changed</div>
        </div>
        
        <div className="flex-1 px-4 py-3 border-r border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
          <div className="text-2xl font-bold text-yellow-400">{metrics.insights}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mt-0.5">Insights Found</div>
        </div>
        
        <div className="flex-1 px-4 py-3 hover:bg-zinc-800/30 transition-colors">
          <div className="text-2xl font-bold text-green-400">{metrics.checkpoints}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mt-0.5">Checkpoints</div>
        </div>
      </div>

      {/* Vertical Timeline - Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-8 px-6">
          {/* Timeline Container */}
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-zinc-700" />

            {/* Timeline Events */}
            <div className="space-y-6">
              {sortedTimeline.map((event, idx) => {
                const colors = getEventColor(event.type);
                const Icon = getEventIcon(event.type);
                const timeData = formatTime(event.timestamp);
                const isSelected = selectedEvent === event;
                
                // Parse JSON fields if needed
                const parseIfNeeded = (data: any) => {
                  if (typeof data === 'string') {
                    try {
                      return JSON.parse(data);
                    } catch (e) {
                      return data;
                    }
                  }
                  return data;
                };

                const memories = parseIfNeeded(event.data?.learned_memories);
                const decisions = parseIfNeeded(event.data?.decisions);
                const memCount = Array.isArray(memories) ? memories.length : 0;
                const decCount = Array.isArray(decisions) ? decisions.length : 0;

                // Parse event content for dev events
                let eventContent = event.data?.content;
                if (typeof eventContent === 'string') {
                  try {
                    eventContent = JSON.parse(eventContent);
                  } catch (e) {
                    eventContent = null;
                  }
                }

                // Extract title/trigger from dev events
                const getEventTitle = () => {
                  // For dev events, check content.data or content.trigger
                  if (event.type === 'event' && eventContent) {
                    if (eventContent.data?.trigger) return eventContent.data.trigger;
                    if (eventContent.trigger) return eventContent.trigger;
                  }
                  
                  // Fallback to standard fields
                  return event.data?.title ||
                    event.data?.decision ||
                    event.data?.insight ||
                    event.data?.pattern ||
                    event.data?.file_path ||
                    event.type;
                };

                // Get file count from dev events
                const getFileCount = () => {
                  if (event.data?.files?.length) return event.data.files.length;
                  if (eventContent?.data?.files?.length) return eventContent.data.files.length;
                  return 0;
                };

                const fileCount = getFileCount();

                return (
                  <div
                    key={`${event.type}-${idx}`}
                    className="relative pl-20"
                  >
                    {/* Timeline Dot */}
                    <div className="absolute left-0 top-0 flex items-center gap-4">
                      <button
                        onClick={() => setSelectedEvent(isSelected ? null : event)}
                        className={`w-16 h-16 rounded-full ${colors.bg} border-4 ${colors.border} flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-110 ${
                          isSelected ? 'ring-4 ring-white ring-offset-2 ring-offset-zinc-950 scale-110' : ''
                        }`}
                      >
                        <Icon className="w-7 h-7 text-white drop-shadow-lg" />
                      </button>
                    </div>

                    {/* Event Card */}
                    <button
                      onClick={() => setSelectedEvent(isSelected ? null : event)}
                      className={`w-full text-left bg-zinc-900/80 border rounded-lg p-4 hover:bg-zinc-800/80 transition-all duration-200 ${
                        isSelected
                          ? `border-${colors.border.split('-')[1]}-500 shadow-lg shadow-${colors.bg.split('-')[1]}-500/20`
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      {/* Event Header */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-1 mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${colors.bg} text-white`}>
                                {event.type}
                              </span>
                            </div>
                            {event.type === 'checkpoint' && event.data?.checkpoint_id && (
                              <div className="text-[11px] font-mono text-blue-400 bg-blue-950/50 px-2 py-1 rounded border border-blue-800/30">
                                {event.data.checkpoint_id}
                              </div>
                            )}
                          </div>
                          <h3 className="text-sm font-semibold text-zinc-100 truncate">
                            {getEventTitle()}
                          </h3>
                        </div>
                        
                        {/* Time Badge */}
                        <div className="flex flex-col items-end flex-shrink-0">
                          <div className="flex items-center gap-1 text-xs text-zinc-400">
                            <Clock className="w-3 h-3" />
                            <span className="font-mono">{timeData.time}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            <span>{timeData.date}</span>
                          </div>
                        </div>
                      </div>

                      {/* Event Metrics */}
                      {(memCount > 0 || decCount > 0 || fileCount > 0) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {memCount > 0 && (
                            <span className="px-2 py-0.5 bg-blue-900/40 border border-blue-700/50 rounded text-[10px] text-blue-300 flex items-center gap-1">
                              <Brain className="w-3 h-3" />
                              {memCount} memories
                            </span>
                          )}
                          {decCount > 0 && (
                            <span className="px-2 py-0.5 bg-orange-900/40 border border-orange-700/50 rounded text-[10px] text-orange-300 flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {decCount} decisions
                            </span>
                          )}
                          {fileCount > 0 && (
                            <span className="px-2 py-0.5 bg-cyan-900/40 border border-cyan-700/50 rounded text-[10px] text-cyan-300 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {fileCount} files
                            </span>
                          )}
                        </div>
                      )}

                      {/* Event Preview Text */}
                      {event.data?.reasoning && (
                        <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{event.data.reasoning}</p>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Event Detail Panel */}
      {selectedEvent && (
        <div className="border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm flex-shrink-0 max-h-[50vh] min-h-0 flex flex-col">
          {/* Header - Fixed */}
          <div className="flex items-start justify-between p-4 border-b border-zinc-800/50 flex-shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-10 h-10 rounded-full ${getEventColor(selectedEvent.type).bg} flex items-center justify-center flex-shrink-0`}>
                {React.createElement(getEventIcon(selectedEvent.type), {
                  className: 'w-5 h-5 text-white',
                })}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-zinc-200 truncate">
                  {(() => {
                    // Parse content for dev events
                    let content = selectedEvent.data?.content;
                    if (typeof content === 'string') {
                      try {
                        content = JSON.parse(content);
                      } catch (e) {
                        content = null;
                      }
                    }
                    
                    // For dev events, check content.data or content.trigger
                    if (selectedEvent.type === 'event' && content) {
                      if (content.data?.trigger) return content.data.trigger;
                      if (content.trigger) return content.trigger;
                    }
                    
                    // Fallback to standard fields
                    return selectedEvent.data?.title ||
                      selectedEvent.data?.decision ||
                      selectedEvent.data?.insight ||
                      selectedEvent.data?.pattern ||
                      selectedEvent.data?.file_path ||
                      selectedEvent.type;
                  })()}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {formatTime(selectedEvent.timestamp).full} • {selectedEvent.type}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedEvent(null);
                }}
                className="p-1 hover:bg-zinc-800 rounded transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(() => {
              // Parse JSON string fields if needed
              const parseIfNeeded = (data: any) => {
                  if (typeof data === 'string') {
                    try {
                      return JSON.parse(data);
                    } catch (e) {
                      return data;
                    }
                  }
                  return data;
                };

                // Parse event content for dev events
                let eventContent = parseIfNeeded(selectedEvent.data?.content);
                
                const parsedData = {
                  ...selectedEvent.data,
                  learned_memories: parseIfNeeded(selectedEvent.data?.learned_memories),
                  decisions: parseIfNeeded(selectedEvent.data?.decisions),
                  findings: parseIfNeeded(selectedEvent.data?.findings),
                  context: parseIfNeeded(selectedEvent.data?.context || selectedEvent.data?.context_data),
                  metadata: parseIfNeeded(selectedEvent.data?.metadata),
                  // For dev events, extract files from content.data
                  files: eventContent?.data?.files || selectedEvent.data?.files,
                  trigger: eventContent?.data?.trigger || eventContent?.trigger || selectedEvent.data?.trigger,
                };

                return (
                  <>
                    {/* Checkpoint ID */}
                    {(parsedData.checkpoint_id || parsedData.title) && (
                      <div>
                        <div className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                          <CheckCircle className="w-3 h-3" />
                          Checkpoint Details:
                        </div>
                        <div className="text-xs bg-zinc-800/50 p-3 rounded space-y-2">
                          {parsedData.checkpoint_id && (
                            <div>
                              <div className="text-zinc-500 text-[10px] uppercase tracking-wide mb-1">Checkpoint ID:</div>
                              <div className="font-mono text-sm text-blue-300 bg-blue-950/50 px-2 py-1.5 rounded border border-blue-800/30 break-all">
                                {parsedData.checkpoint_id}
                              </div>
                            </div>
                          )}
                          {parsedData.title && (
                            <div>
                              <div className="text-zinc-500 text-[10px] uppercase tracking-wide mb-1">Title:</div>
                              <div className="text-zinc-200">{parsedData.title}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Two-Column Grid for Memories and Decisions */}
                    {(Array.isArray(parsedData.learned_memories) && parsedData.learned_memories.length > 0) || 
                     (Array.isArray(parsedData.decisions) && parsedData.decisions.length > 0) ? (
                      <div className="grid grid-cols-2 gap-4">
                        {/* Left Column: Learned Memories */}
                        {Array.isArray(parsedData.learned_memories) && parsedData.learned_memories.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                              <Brain className="w-3 h-3" />
                              Learned Memories ({parsedData.learned_memories.length}):
                            </div>
                            <div className="space-y-1.5">
                              {parsedData.learned_memories.map((memory: string, idx: number) => (
                                <div key={idx} className="text-xs text-zinc-300 bg-zinc-800/50 p-2.5 rounded flex items-start gap-2">
                                  <span className="text-blue-400 flex-shrink-0 mt-0.5">•</span>
                                  <span className="leading-relaxed">{memory}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Right Column: Decisions */}
                        {Array.isArray(parsedData.decisions) && parsedData.decisions.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                              <Target className="w-3 h-3" />
                              Decisions ({parsedData.decisions.length}):
                            </div>
                            <div className="space-y-2">
                              {parsedData.decisions.map((decision: any, idx: number) => (
                                <div key={idx} className="text-xs bg-zinc-800/50 p-3 rounded space-y-1.5">
                                  <div className="font-medium text-orange-300">
                                    {typeof decision === 'string' ? decision : (decision.decision || 'Decision')}
                                  </div>
                                  {decision.reasoning && (
                                    <div className="text-zinc-400">
                                      <span className="text-zinc-500">Reasoning:</span> {decision.reasoning}
                                    </div>
                                  )}
                                  {decision.alternatives && Array.isArray(decision.alternatives) && decision.alternatives.length > 0 && (
                                    <div className="text-zinc-400">
                                      <span className="text-zinc-500">Alternatives:</span>
                                      <ul className="list-disc list-inside mt-1 space-y-0.5 pl-2">
                                        {decision.alternatives.map((alt: any, altIdx: number) => (
                                          <li key={altIdx}>{typeof alt === 'string' ? alt : JSON.stringify(alt)}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Findings */}
                    {Array.isArray(parsedData.findings) && parsedData.findings.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                          <Lightbulb className="w-3 h-3" />
                          Findings ({parsedData.findings.length}):
                        </div>
                        <div className="space-y-1.5">
                          {parsedData.findings.map((finding: string, idx: number) => (
                            <div key={idx} className="text-xs text-zinc-300 bg-zinc-800/50 p-2.5 rounded flex items-start gap-2">
                              <span className="text-yellow-400 flex-shrink-0 mt-0.5">•</span>
                              <span className="leading-relaxed">{finding}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files (for dev events) */}
                    {Array.isArray(parsedData.files) && parsedData.files.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                          <FileText className="w-3 h-3" />
                          Files Changed ({parsedData.files.length}):
                        </div>
                        <div className="space-y-2">
                          {parsedData.files.map((file: any, idx: number) => (
                            <div key={idx} className="text-xs bg-zinc-800/50 p-3 rounded space-y-1">
                              <div className="font-medium text-cyan-300 font-mono text-[11px]">
                                {file.file || file.path || file}
                              </div>
                              {file.change && (
                                <div className="text-zinc-400">
                                  <span className="text-zinc-500">Change:</span> {file.change}
                                </div>
                              )}
                              {file.reason && (
                                <div className="text-zinc-400">
                                  <span className="text-zinc-500">Reason:</span> {file.reason}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trigger (for dev events) */}
                    {parsedData.trigger && (
                      <div>
                        <div className="text-xs font-medium text-zinc-400 mb-1.5">Trigger:</div>
                        <div className="text-xs text-zinc-300 bg-zinc-800/50 p-2.5 rounded">
                          {parsedData.trigger}
                        </div>
                      </div>
                    )}

                    {/* Context - 2 Column Grid */}
                    {parsedData.context && typeof parsedData.context === 'object' && Object.keys(parsedData.context).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-zinc-400 mb-1.5">Context:</div>
                        <div className="grid grid-cols-2 gap-3 bg-zinc-800/50 p-3 rounded">
                          {Object.entries(parsedData.context).map(([key, value]) => (
                            <div key={key} className="space-y-1">
                              <span className="text-zinc-500 font-medium text-[11px] block">{key}:</span>
                              <span className="text-zinc-300 text-xs block">
                                {typeof value === 'object' ? (
                                  <pre className="whitespace-pre-wrap break-words font-mono text-[10px] overflow-hidden">
                                    {JSON.stringify(value, null, 2)}
                                  </pre>
                                ) : (
                                  String(value)
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Document Content */}
                    {selectedEvent.type === 'document' && selectedEvent.data && (
                      <div>
                        <div className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                          <FileText className="w-3 h-3" />
                          Document: {selectedEvent.data.title}
                        </div>
                        <div className="text-xs bg-zinc-800/50 p-3 rounded space-y-2">
                          <div>
                            <span className="text-zinc-500">Type:</span>{' '}
                            <span className="text-pink-300">{selectedEvent.data.doc_type}</span>
                          </div>
                          {selectedEvent.data.is_large && (
                            <div className="text-orange-400">
                              Large document (stored in filesystem)
                            </div>
                          )}
                          {selectedEvent.data.file_path && (
                            <div>
                              <span className="text-zinc-500">Path:</span>{' '}
                              <span className="text-cyan-300 font-mono text-[10px]">{selectedEvent.data.file_path}</span>
                            </div>
                          )}
                          {selectedEvent.data.content && (
                            <div>
                              <div className="text-zinc-500 mb-1">Preview:</div>
                              <div className="text-zinc-300 text-[11px] line-clamp-3">
                                {selectedEvent.data.content.substring(0, 200)}...
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setViewingDocument(selectedEvent.data as Document);
                              setSelectedEvent(null);
                            }}
                            className="w-full mt-2 px-3 py-1.5 bg-pink-900/40 hover:bg-pink-900/60 border border-pink-700 rounded text-xs text-pink-200 transition-colors"
                          >
                            View Full Document
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Metadata - Flex Row */}
                    {parsedData.metadata && typeof parsedData.metadata === 'object' && Object.keys(parsedData.metadata).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-zinc-400 mb-1.5">Metadata:</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(parsedData.metadata).map(([key, value]) => (
                            <div key={key} className="px-2.5 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs">
                              <span className="text-zinc-500 font-medium">{key}:</span>{' '}
                              <span className="text-zinc-300">
                                {Array.isArray(value) ? (
                                  value.join(', ')
                                ) : typeof value === 'object' ? (
                                  JSON.stringify(value)
                                ) : (
                                  String(value)
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
        </div>
      )}

      {/* Document Viewer */}
      {viewingDocument && (
        <DocumentViewer
          document={viewingDocument}
          onClose={() => setViewingDocument(null)}
          showMetadataByDefault={false}
        />
      )}
    </div>
  );
};
