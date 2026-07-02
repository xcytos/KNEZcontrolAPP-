import React, { useState, useEffect, useCallback } from 'react';
import { Loader, AlertCircle } from 'lucide-react';
import { SessionEvolutionChart } from '../../data/components/SessionEvolutionChart';
import { SessionMetadataSidebar } from '../../data/components/SessionMetadataSidebar';
import { taqwinDataService } from '../../../services/data/TaqwinDataService';
import type { SessionContext } from '../types';

interface EvolutionLensProps {
  sessionContext: SessionContext;
}

export const EvolutionLens: React.FC<EvolutionLensProps> = ({ sessionContext }) => {
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!sessionContext.sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const hierarchy = await taqwinDataService.getSessionHierarchy(sessionContext.sessionId);
      if (hierarchy && hierarchy.session) {
        const timeline = buildTimeline(hierarchy);
        const stats = {
          checkpoints: hierarchy.checkpoints?.length || 0,
          events: hierarchy.events?.length || 0,
          memories: hierarchy.memories?.length || 0,
          decisions: hierarchy.decisions?.length || 0,
          files: hierarchy.files?.length || 0,
          documents: 0,
        };
        setSessionData({
          session: hierarchy.session,
          checkpoints: hierarchy.checkpoints || [],
          documents: [],
          timeline,
          stats,
        });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [sessionContext.sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!sessionContext.sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No session selected</p>
          <p className="text-xs text-zinc-600 mt-1">Select a session from Dashboard &gt; Hierarchy to view evolution</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400">
        <AlertCircle className="w-5 h-5 mr-2" />
        {error}
      </div>
    );
  }

  if (!sessionData) return null;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <SessionEvolutionChart
            timeline={sessionData.timeline}
            sessionStart={sessionData.session?.created_at || ''}
            sessionEnd={sessionData.session?.updated_at || ''}
            sessionId={sessionContext.sessionId}
          />
        </div>
      </div>
      <div className="w-80 border-l border-zinc-800 bg-zinc-900/20 overflow-y-auto">
        <SessionMetadataSidebar
          session={sessionData.session}
          stats={sessionData.stats}
          loading={loading}
        />
      </div>
    </div>
  );
};

function buildTimeline(hierarchy: any): any[] {
  const events: any[] = [];
  for (const cp of hierarchy.checkpoints || []) {
    events.push({ type: 'checkpoint', timestamp: cp.created_at || cp.updated_at, data: cp });
    if (cp.decisions) {
      for (const d of (typeof cp.decisions === 'string' ? JSON.parse(cp.decisions) : cp.decisions)) {
        events.push({ type: 'decision', timestamp: cp.created_at, data: { ...d, parent_checkpoint: cp.checkpoint_id } });
      }
    }
    if (cp.findings) {
      for (const f of (typeof cp.findings === 'string' ? JSON.parse(cp.findings) : cp.findings)) {
        events.push({ type: 'insight', timestamp: cp.created_at, data: { ...f, parent_checkpoint: cp.checkpoint_id } });
      }
    }
  }
  for (const evt of hierarchy.events || []) {
    events.push({ type: 'event', timestamp: evt.created_at || evt.timestamp, data: evt });
  }
  for (const mem of hierarchy.memories || []) {
    events.push({ type: 'insight', timestamp: mem.created_at, data: mem });
  }
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}
