import React, { useState } from 'react';
import { X, FileText, Calendar, Tag, ExternalLink, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Document } from './DocumentList';

interface DocumentViewerProps {
  document: Document;
  onClose: () => void;
  showMetadataByDefault?: boolean;
}

/**
 * Reusable Document Viewer Component
 * Displays document content with toggleable metadata
 * Can be used in detail panels, modals, or embedded views
 */
export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  onClose,
  showMetadataByDefault = false,
}) => {
  const [showMetadata, setShowMetadata] = useState(showMetadataByDefault);

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

  const handleCopyPath = () => {
    if (document.file_path) {
      navigator.clipboard.writeText(document.file_path);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-1/2 bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl z-40">
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm flex-shrink-0">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-pink-400 flex-shrink-0" />
            <h2 className="text-lg font-semibold text-zinc-200 truncate">
              {document.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded border ${getTypeColor(document.doc_type)}`}>
              {document.doc_type}
            </span>
            {document.is_large && (
              <span className="text-xs px-2 py-1 rounded bg-orange-900/30 text-orange-400 border border-orange-700">
                Large Document
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
          title="Close"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Metadata Toggle Button */}
      <div className="px-6 py-2 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {showMetadata ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>{showMetadata ? 'Hide' : 'Show'} Details</span>
        </button>
      </div>

      {/* Metadata Section (Collapsible) */}
      {showMetadata && (
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 space-y-3 flex-shrink-0">
          {/* Document ID - Prominent Display */}
          <div>
            <div className="text-zinc-500 text-xs mb-1 flex items-center gap-1 font-semibold">
              <FileText className="w-3 h-3" />
              Document ID
            </div>
            <div className="flex items-center gap-2">
              <div className="text-zinc-100 text-xs font-mono bg-blue-950/50 border border-blue-800/30 px-2 py-1.5 rounded break-all flex-1">
                {document.document_id}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(document.document_id)}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
                title="Copy document ID"
              >
                <Copy className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-zinc-500 text-xs mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Created
              </div>
              <div className="text-zinc-300 text-xs">
                {formatDate(document.created_at)}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Updated
              </div>
              <div className="text-zinc-300 text-xs">
                {formatDate(document.updated_at)}
              </div>
            </div>
          </div>

          {document.session_id && (
            <div>
              <div className="text-zinc-500 text-xs mb-1">Session ID</div>
              <div className="flex items-center gap-2">
                <div className="text-zinc-300 text-xs font-mono bg-zinc-800/50 px-2 py-1 rounded break-all flex-1">
                  {document.session_id}
                </div>
                <button
                  onClick={() => document.session_id && navigator.clipboard.writeText(document.session_id)}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  title="Copy session ID"
                >
                  <Copy className="w-3 h-3 text-zinc-400" />
                </button>
              </div>
            </div>
          )}

          {document.checkpoint_id && (
            <div>
              <div className="text-zinc-500 text-xs mb-1">Checkpoint ID</div>
              <div className="flex items-center gap-2">
                <div className="text-zinc-300 text-xs font-mono bg-zinc-800/50 px-2 py-1 rounded break-all flex-1">
                  {document.checkpoint_id}
                </div>
                <button
                  onClick={() => document.checkpoint_id && navigator.clipboard.writeText(document.checkpoint_id)}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  title="Copy checkpoint ID"
                >
                  <Copy className="w-3 h-3 text-zinc-400" />
                </button>
              </div>
            </div>
          )}

          {document.project_name && (
            <div>
              <div className="text-zinc-500 text-xs mb-1">Project</div>
              <div className="text-zinc-300 text-xs">{document.project_name}</div>
            </div>
          )}

          {document.file_path && (
            <div>
              <div className="text-zinc-500 text-xs mb-1">File Path</div>
              <div className="flex items-center gap-2">
                <div className="text-zinc-300 text-xs font-mono bg-zinc-800/50 px-2 py-1 rounded flex-1 truncate">
                  {document.file_path}
                </div>
                <button
                  onClick={handleCopyPath}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  title="Copy path"
                >
                  <Copy className="w-3 h-3 text-zinc-400" />
                </button>
                <a
                  href={`file://${document.file_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  title="Open file"
                >
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              </div>
            </div>
          )}

          {document.tags && document.tags.length > 0 && (
            <div>
              <div className="text-zinc-500 text-xs mb-2 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Tags
              </div>
              <div className="flex gap-1 flex-wrap">
                {document.tags.map((tag, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-zinc-700/50 rounded text-zinc-300">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-zinc-500 text-xs mb-3 uppercase tracking-wide">Content</div>
        {document.content ? (
          <div className="prose prose-sm prose-invert max-w-none text-zinc-300 text-sm leading-relaxed">
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-zinc-100 mt-6 mb-4" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-bold text-zinc-100 mt-5 mb-3" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-zinc-200 mt-4 mb-2" {...props} />,
                p: ({node, ...props}) => <p className="mb-4 text-zinc-300" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 text-zinc-300 space-y-1" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 text-zinc-300 space-y-1" {...props} />,
                li: ({node, ...props}) => <li className="text-zinc-300" {...props} />,
                code: ({node, inline, ...props}: any) =>
                  inline ? (
                    <code className="px-1.5 py-0.5 bg-zinc-800 text-pink-300 rounded text-xs font-mono" {...props} />
                  ) : (
                    <code className="block p-3 bg-zinc-800 rounded text-xs font-mono overflow-x-auto" {...props} />
                  ),
                pre: ({node, ...props}) => <pre className="bg-zinc-800 rounded p-3 overflow-x-auto mb-4" {...props} />,
                blockquote: ({node, ...props}) => (
                  <blockquote className="border-l-4 border-zinc-700 pl-4 italic text-zinc-400 my-4" {...props} />
                ),
                a: ({node, ...props}) => (
                  <a className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer" {...props} />
                ),
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="min-w-full border border-zinc-700" {...props} />
                  </div>
                ),
                th: ({node, ...props}) => <th className="border border-zinc-700 px-3 py-2 bg-zinc-800 text-left" {...props} />,
                td: ({node, ...props}) => <td className="border border-zinc-700 px-3 py-2" {...props} />,
              }}
            >
              {document.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-zinc-500 text-sm py-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <div>Content not loaded</div>
            <div className="text-xs mt-2">
              {document.is_large ? 'Large document stored in filesystem' : 'Content may need to be fetched'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
