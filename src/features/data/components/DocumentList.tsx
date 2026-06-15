import React from 'react';
import { FileText, AlertCircle, ExternalLink } from 'lucide-react';

export interface Document {
  document_id: string;
  title: string;
  doc_type: 'requirement' | 'design' | 'specification' | 'note' | 'form' | 'other';
  content?: string;
  session_id?: string;
  project_name?: string;
  checkpoint_id?: string;
  created_at: string;
  updated_at: string;
  is_large: boolean;
  file_path?: string;
  tags?: string[];
}

interface DocumentListProps {
  documents: Document[];
  onDocumentClick?: (doc: Document) => void;
  compact?: boolean;
  showSessionInfo?: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onDocumentClick,
  compact = false,
  showSessionInfo = true,
}) => {
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      requirement: 'bg-blue-900/30 text-blue-400 border-blue-700',
      design: 'bg-purple-900/30 text-purple-400 border-purple-700',
      note: 'bg-zinc-700/30 text-zinc-400 border-zinc-600',
      form: 'bg-green-900/30 text-green-400 border-green-700',
      specification: 'bg-orange-900/30 text-orange-400 border-orange-700',
      other: 'bg-zinc-700/30 text-zinc-400 border-zinc-600',
    };
    return colors[type] || colors.other;
  };

  const getTypeIcon = (type: string) => {
    // Return emoji or icon based on doc type
    const icons: Record<string, string> = {
      requirement: '📋',
      design: '🎨',
      specification: '📄',
      note: '📝',
      form: '📑',
      other: '📄',
    };
    return icons[type] || '📄';
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <div className="text-sm">No documents found</div>
      </div>
    );
  }

  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      {documents.map((doc) => (
        <div
          key={doc.document_id}
          onClick={() => onDocumentClick?.(doc)}
          className={`
            ${compact ? 'p-3' : 'p-4'}
            bg-zinc-800/40 border border-zinc-700/50 rounded-lg
            ${onDocumentClick ? 'hover:bg-zinc-800/60 hover:border-pink-600/50 cursor-pointer' : ''}
            transition-all duration-200
          `}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="text-lg flex-shrink-0">{getTypeIcon(doc.doc_type)}</span>
              <h3 className={`font-medium text-zinc-200 flex-1 ${compact ? 'text-sm' : ''} truncate`}>
                {doc.title}
              </h3>
            </div>
            <span className={`text-xs px-2 py-1 rounded border ${getTypeColor(doc.doc_type)} flex-shrink-0 ml-2`}>
              {doc.doc_type}
            </span>
          </div>

          <div className={`text-xs text-zinc-400 space-y-1 ${compact ? 'text-[11px]' : ''}`}>
            {showSessionInfo && doc.session_id && (
              <div className="font-mono">Session: {doc.session_id.slice(0, 8)}...</div>
            )}
            {doc.project_name && (
              <div>Project: {doc.project_name}</div>
            )}
            {doc.checkpoint_id && (
              <div className="font-mono">Checkpoint: {doc.checkpoint_id}</div>
            )}
            <div>Created: {new Date(doc.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
          </div>

          {doc.tags && doc.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              {doc.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-zinc-700/50 rounded text-zinc-300">
                  #{tag}
                </span>
              ))}
              {doc.tags.length > 3 && (
                <span className="text-[10px] px-1.5 py-0.5 text-zinc-500">
                  +{doc.tags.length - 3} more
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            {doc.is_large && (
              <div className="text-[10px] text-orange-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Large (file)
              </div>
            )}
            {doc.file_path && (
              <div className="text-[10px] text-cyan-400 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                {doc.file_path.split('/').pop()}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
