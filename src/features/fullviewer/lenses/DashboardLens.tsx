import React, { useState, useCallback, useEffect } from 'react';
import { LayoutDashboard, BarChart3, Activity, Loader, AlertCircle } from 'lucide-react';
import { TaqwinHierarchicalView } from '../../data/TaqwinHierarchicalView';
import { ActiveSessionsPanel } from '../../dashboard/ActiveSessionsPanel';
import { SessionEvolutionChart } from '../../data/components/SessionEvolutionChart';
import { taqwinDataService } from '../../../services/data/TaqwinDataService';
import type { SessionContext } from '../types';

interface DashboardLensProps {
  sessionContext: SessionContext;
  onSessionContextChange: (ctx: SessionContext) => void;
}

type DashboardTab = 'hierarchy' | 'evolution' | 'sessions';

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

export const DashboardLens: React.FC<DashboardLensProps> = ({ sessionContext, onSessionContextChange }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('hierarchy');
  const [evolutionData, setEvolutionData] = useState<any>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);

  const handleActivityContextChange = useCallback((ctx: SessionContext) => {
    onSessionContextChange(ctx);
  }, [onSessionContextChange]);

  useEffect(() => {
    const sid = sessionContext.sessionId;
    if (!sid) {
      setEvolutionData(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setEvolutionLoading(true);
      setEvolutionError(null);
      try {
        const hierarchy = await taqwinDataService.getSessionHierarchy(sid);
        if (cancelled) return;
        if (hierarchy && hierarchy.session) {
          const timeline = buildTimeline(hierarchy);
          setEvolutionData({
            session: hierarchy.session,
            timeline,
            sessionStart: hierarchy.session.created_at || '',
            sessionEnd: hierarchy.session.updated_at || '',
          });
        }
      } catch (e) {
        if (!cancelled) setEvolutionError(String(e));
      } finally {
        if (!cancelled) setEvolutionLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [sessionContext.sessionId]);

  const tabs = [
    { id: 'hierarchy' as DashboardTab, label: 'Hierarchy', icon: LayoutDashboard },
    { id: 'evolution' as DashboardTab, label: 'Evolution', icon: BarChart3 },
    { id: 'sessions' as DashboardTab, label: 'Sessions', icon: Activity },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30 flex-shrink-0">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'hierarchy' && (
          <TaqwinHierarchicalView
            onNavigateToSqlite={() => {}}
            onActivityContextChange={handleActivityContextChange}
          />
        )}
        {activeTab === 'evolution' && (
          <div className="h-full overflow-y-auto">
            {!sessionContext.sessionId ? (
              <div className="h-full flex items-center justify-center text-zinc-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No session selected</p>
                  <p className="text-xs text-zinc-600 mt-1">Select a session from the Hierarchy tab</p>
                </div>
              </div>
            ) : evolutionLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : evolutionError ? (
              <div className="h-full flex items-center justify-center text-red-400">
                <AlertCircle className="w-5 h-5 mr-2" />
                {evolutionError}
              </div>
            ) : evolutionData ? (
              <div className="p-4">
                <SessionEvolutionChart
                  timeline={evolutionData.timeline}
                  sessionStart={evolutionData.sessionStart}
                  sessionEnd={evolutionData.sessionEnd}
                  sessionId={sessionContext.sessionId}
                />
              </div>
            ) : null}
          </div>
        )}
        {activeTab === 'sessions' && (
          <ActiveSessionsPanel
            currentSessionId={sessionContext.sessionId}
            currentProjectId={sessionContext.projectId}
          />
        )}
      </div>
    </div>
  );
};
