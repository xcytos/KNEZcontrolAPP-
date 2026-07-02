import React, { useState, useEffect } from 'react';
import { Loader, AlertCircle } from 'lucide-react';
import { RepoVisualizer } from '../../repo/RepoVisualizer';
import { taqwinDataService } from '../../../services/data/TaqwinDataService';
import type { SessionContext } from '../types';

interface RepositoryLensProps {
  sessionContext: SessionContext;
}

export const RepositoryLens: React.FC<RepositoryLensProps> = ({ sessionContext }) => {
  const [projects, setProjects] = useState<Array<{ project_id: string; project_name: string; project_path: string | null }>>([]);
  const [sessions, setSessions] = useState<Array<{ session_id: string; display_id: string; name: string; project_id?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [all, allProjects] = await Promise.all([
          taqwinDataService.listSessions(200),
          taqwinDataService.listProjects(),
        ]);
        setSessions(all.map((s: any) => ({
          session_id: s.session_id || s.id,
          display_id: s.display_id || s.session_id?.slice(0, 8) || '',
          name: s.name || 'Unnamed',
          project_id: s.project_id,
        })));
        setProjects(allProjects.map((p: any) => ({
          project_id: p.project_id,
          project_name: p.project_name || p.name,
          project_path: p.project_path || null,
        })));
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
        <span>Failed to load: {error}</span>
      </div>
    );
  }

  return (
    <RepoVisualizer
      projects={projects}
      dbPath={taqwinDataService.getDatabasePath()}
      allSessions={sessions}
      currentSessionId={sessionContext.sessionId}
    />
  );
};
