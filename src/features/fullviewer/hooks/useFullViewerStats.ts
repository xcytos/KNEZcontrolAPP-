import { useState, useEffect } from 'react';
import { taqwinDataService } from '../../../services/data/TaqwinDataService';

interface SessionMetrics {
  checkpoints: number;
  events: number;
  memories: number;
  decisions: number;
  files: number;
  documents: number;
}

interface StatusBarMetrics {
  totalProjects: number;
  totalSessions: number;
  activeCount: number;
}

export function useFullViewerStats(sessionId?: string) {
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics | undefined>();
  const [statusBarMetrics, setStatusBarMetrics] = useState<StatusBarMetrics | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [allSessions, allProjects] = await Promise.all([
          taqwinDataService.listSessions(200),
          taqwinDataService.listProjects(),
        ]);
        setStatusBarMetrics({
          totalProjects: allProjects.length,
          totalSessions: allSessions.length,
          activeCount: allSessions.filter(
            (s: any) => s.status === 'active' || s.connection_state === 'active'
          ).length,
        });

        if (sessionId) {
          const counts = await taqwinDataService.getSessionCounts(sessionId);
          setSessionMetrics({
            checkpoints: counts.checkpoints || 0,
            events: counts.events || 0,
            memories: counts.memories || 0,
            decisions: counts.decisions || 0,
            files: counts.files || 0,
            documents: counts.documents || 0,
          });
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  return { sessionMetrics, statusBarMetrics, loading, error };
}
