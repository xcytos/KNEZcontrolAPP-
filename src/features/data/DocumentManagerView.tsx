import React, { useEffect, useState } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Layers,
  Shield,
  Zap,
  Code,
  GitBranch,
  Tags,
  Calendar,
  FolderOpen,
} from 'lucide-react';

interface Document {
  document_id: string;
  title: string;
  doc_type: string;
  content: string;
  project_name?: string;
  session_id?: string;
  checkpoint_id?: string;
  created_at: string;
  updated_at: string;
  size_bytes?: number;
  file_path?: string;
  is_large?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

export const DocumentManagerView: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedDetails, setExpandedDetails] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Query PostgreSQL for all documents
      const response = await fetch('http://localhost:3000/api/documents');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err: any) {
      console.error('[DocumentManagerView] Failed to load documents:', err);
      setError(err?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const docTypes = ['all', 'requirement', 'design', 'note', 'form', 'specification', 'other'];
  const filteredDocs = filterType === 'all' 
    ? documents 
    : documents.filter(d => d.doc_type === filterType);

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

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Extract metadata categories
  const getDocumentMetadata = (doc: Document) => {
    if (!doc.metadata) return null;

    return {
      integrationPoints: doc.metadata.integration_points || [],
      patternsUsed: doc.metadata.patterns_used || [],
      performanceImprovements: doc.metadata.performance_improvements || [],
      securityEnhancements: doc.metadata.security_enhancements || [],
      techStack: doc.metadata.tech_stack || [],
      fileChanges: doc.metadata.file_changes || [],
    };
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Filters */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/30 overflow-y-auto">
        <div className="p-4">
          {/* Stats */}
          <div className="mb-6 p-3 bg-zinc-800/30 rounded-lg">
            <div className="text-xs text-zinc-400 mb-2">Total Documents</div>
            <div className="text-2xl font-bold text-zinc-200">{documents.length}</div>
            <div className="text-xs text-zinc-500 mt-1">
              {documents.filter(d => d.is_large).length} large files
            </div>
          </div>

          {/* Type Filters */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Document Type</h3>
            <div className="space-y-1">
              {docTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`
                    w-full text-left px-3 py-2 rounded text-sm transition-colors
                    ${filterType === type 
                      ? 'bg-blue-900/30 text-blue-200 border border-blue-700' 
                      : 'text-zinc-400 hover:bg-zinc-800/50 border border-transparent'
                    }
                  `}
                >
                  <span className="capitalize">{type}</span>
                  <span className="text-xs ml-2 opacity-60">
                    ({type === 'all' ? documents.length : documents.filter(d => d.doc_type === type).length})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Search */}
        <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/20">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="Search documents (semantic search via Document Manager MCP)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              <button
                disabled={loading}
                className="px-4 py-2 bg-blue-900 text-blue-100 rounded-lg hover:bg-blue-800 disabled:opacity-50 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
            <button
              onClick={loadDocuments}
              disabled={loading}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 mb-4">
              <AlertCircle className="w-5 h-5 inline mr-2" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              No documents found
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredDocs.map((doc) => {
                const metadata = getDocumentMetadata(doc);
                const isSelected = selectedDoc?.document_id === doc.document_id;

                return (
                  <div
                    key={doc.document_id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'bg-blue-900/20 border-blue-700'
                        : 'bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800/60 hover:border-zinc-600'
                    }`}
                  >
                    {/* Header */}
                    <div 
                      className="flex items-start justify-between mb-3"
                      onClick={() => setSelectedDoc(isSelected ? null : doc)}
                    >
                      <h3 className="font-medium text-zinc-200 flex-1 pr-4">{doc.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded border ${getTypeColor(doc.doc_type)}`}>
                          {doc.doc_type}
                        </span>
                        {isSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDetails(!expandedDetails);
                            }}
                            className="p-1 hover:bg-zinc-700 rounded transition-colors"
                          >
                            {expandedDetails ? (
                              <ChevronUp className="w-4 h-4 text-zinc-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-zinc-400" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 mb-3">
                      {doc.project_name && (
                        <div className="flex items-center gap-1.5">
                          <FolderOpen className="w-3 h-3" />
                          <span>{doc.project_name}</span>
                        </div>
                      )}
                      {doc.session_id && (
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3 h-3" />
                          <span className="font-mono">{doc.session_id.slice(0, 8)}...</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3" />
                        <span>{formatBytes(doc.size_bytes)}</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-3">
                        {doc.tags.slice(0, 4).map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 bg-zinc-700/50 border border-zinc-600 rounded text-zinc-300 flex items-center gap-1">
                            <Tags className="w-3 h-3" />
                            {tag}
                          </span>
                        ))}
                        {doc.tags.length > 4 && (
                          <span className="text-xs px-2 py-0.5 text-zinc-500">
                            +{doc.tags.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Expanded Details */}
                    {isSelected && expandedDetails && metadata && (
                      <div className="mt-4 pt-4 border-t border-zinc-700 space-y-4">
                        {/* Integration Points */}
                        {metadata.integrationPoints.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-blue-400" />
                              INTEGRATION POINTS:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {metadata.integrationPoints.map((point: string, idx: number) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-zinc-800/50 border border-zinc-700 rounded text-zinc-300">
                                  {point}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Patterns Used */}
                        {metadata.patternsUsed.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                              <GitBranch className="w-4 h-4 text-purple-400" />
                              PATTERNS USED:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {metadata.patternsUsed.map((pattern: string, idx: number) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-zinc-800/50 border border-zinc-700 rounded text-zinc-300">
                                  {pattern}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Performance Improvements */}
                        {metadata.performanceImprovements.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-yellow-400" />
                              PERFORMANCE IMPROVEMENTS:
                            </div>
                            <div className="space-y-1">
                              {metadata.performanceImprovements.map((improvement: string, idx: number) => (
                                <div key={idx} className="text-xs text-zinc-300 bg-zinc-800/30 p-2 rounded">
                                  {improvement}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Security Enhancements */}
                        {metadata.securityEnhancements.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                              <Shield className="w-4 h-4 text-green-400" />
                              SECURITY ENHANCEMENTS:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {metadata.securityEnhancements.map((enhancement: string, idx: number) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-zinc-800/50 border border-zinc-700 rounded text-zinc-300">
                                  {enhancement}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tech Stack */}
                        {metadata.techStack.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                              <Code className="w-4 h-4 text-orange-400" />
                              TECH STACK:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {metadata.techStack.map((tech: string, idx: number) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-zinc-800/50 border border-zinc-700 rounded text-zinc-300">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* File Changes */}
                        {metadata.fileChanges.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                              <GitBranch className="w-4 h-4 text-cyan-400" />
                              FILE CHANGES:
                            </div>
                            <div className="space-y-1">
                              {metadata.fileChanges.map((change: any, idx: number) => (
                                <div key={idx} className="text-xs bg-zinc-800/30 p-2 rounded space-y-1">
                                  <div className="font-mono text-cyan-300">{change.file}</div>
                                  <div className="text-zinc-400 flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                      change.change === 'CREATE' ? 'bg-green-900/30 text-green-400' :
                                      change.change === 'MODIFY' ? 'bg-yellow-900/30 text-yellow-400' :
                                      'bg-red-900/30 text-red-400'
                                    }`}>
                                      {change.change}
                                    </span>
                                    {change.reason && <span>{change.reason}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Storage Location */}
                    {doc.is_large && doc.file_path && (
                      <div className="mt-3 text-xs text-orange-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Large document stored at: {doc.file_path}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
