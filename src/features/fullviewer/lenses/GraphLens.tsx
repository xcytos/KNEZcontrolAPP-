import React, { useState, useEffect } from 'react';
import { Loader, AlertCircle } from 'lucide-react';
import { RelationshipGraph } from '../../data/components/RelationshipGraph';
import { taqwinDataService } from '../../../services/data/TaqwinDataService';

interface GraphLensProps {
  onClose?: () => void;
  onNavigateToSession?: (sessionId: string, projectId: string) => void;
  onNavigateToProject?: (projectId: string) => void;
}

export const GraphLens: React.FC<GraphLensProps> = ({ onClose, onNavigateToSession, onNavigateToProject }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
        const allDocs: any[] = [];
        setSessions(allSessions.map((s: any) => ({
          session_id: s.session_id || s.id,
          display_id: s.display_id || '',
          name: s.name || '',
          project_id: s.project_id,
          created_at: s.created_at,
        })));
        setProjects(allProjects.map((p: any) => ({
          project_id: p.project_id,
          project_name: p.project_name || p.name,
          project_path: p.project_path,
          sessions: [],
          children: [],
        })));
        setDocuments(allDocs);
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
        {error}
      </div>
    );
  }

  return (
    <div className="h-full">
      <RelationshipGraph
        projects={projects}
        allSessions={sessions}
        allDocuments={documents}
        onClose={onClose || (() => {})}
        onNavigateToSession={onNavigateToSession}
        onNavigateToProject={onNavigateToProject}
      />
    </div>
  );
};
