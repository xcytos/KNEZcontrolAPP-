import React, { useEffect, useState } from 'react';
import { Server, FileText, Search, RefreshCw, AlertCircle, CheckCircle, XCircle, Database as DatabaseIcon, Settings } from 'lucide-react';
import { postgresService, PgDocument } from '../../services/data/DatabaseService';
import { RecordDetailPanel } from './components/RecordDetailPanel';
import { ensurePostgresConnection } from '../../services/data/PostgresConnectionManager';

interface HealthStatus {
  connected: boolean;
  host: string;
  database: string;
}

export const PostgresDataView: React.FC = () => {
  const [documents, setDocuments] = useState<PgDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<PgDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [connecting, setConnecting] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [config, setConfig] = useState({
    host: 'db.sspsljqdhesqezrmspcj.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'TAQWIN%21%40%23777',
  });

  useEffect(() => {
    initializeConnection();
  }, []);

  const initializeConnection = async () => {
    setConnecting(true);
    setError(null);
    try {
      const connected = await ensurePostgresConnection(config);
      if (connected) {
        setHealth({
          connected: true,
          host: config.host,
          database: config.database,
        });
        await loadDocuments();
      } else {
        setError('Failed to connect to PostgreSQL');
        setHealth({
          connected: false,
          host: config.host,
          database: config.database,
        });
      }
    } catch (err: any) {
      console.error('[PostgresDataView] Connection error:', err);
      setError(err?.message || 'Failed to initialize connection');
      setHealth({
        connected: false,
        host: config.host,
        database: config.database,
      });
    } finally {
      setConnecting(false);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await postgresService.listDocuments(100);
      setDocuments(docs);
    } catch (err: any) {
      console.error('[PostgresDataView] Failed to load documents:', err);
      setError(err?.message || 'Failed to load documents from PostgreSQL');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadDocuments();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const docs = await postgresService.searchDocuments(searchQuery, 50);
      setDocuments(docs);
    } catch (err: any) {
      console.error('[PostgresDataView] Search failed:', err);
      setError(err?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (doc: PgDocument) => {
    // If we don't have content, fetch it
    if (!doc.content) {
      try {
        const fullDoc = await postgresService.getDocument(doc.document_id);
        if (fullDoc) {
          setSelectedDoc(fullDoc);
        }
      } catch (err) {
        console.error('[PostgresDataView] Failed to fetch document:', err);
        setSelectedDoc(doc); // Show what we have
      }
    } else {
      setSelectedDoc(doc);
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

  const getHealthIcon = (connected?: boolean) => {
    if (connected === undefined) return <AlertCircle className="w-4 h-4 text-zinc-500" />;
    if (connected) {
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    }
    return <XCircle className="w-4 h-4 text-red-400" />;
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Filters & Health */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/30 overflow-y-auto">
        <div className="p-4">
          {/* Health Status */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <Server className="w-4 h-4" />
              Connection Status
            </h3>
            {health ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-zinc-800/30 rounded">
                  <span className="text-zinc-400">Status</span>
                  {getHealthIcon(health.connected)}
                </div>
                <div className="p-2 bg-zinc-800/30 rounded space-y-1">
                  <div className="text-zinc-400">Host:</div>
                  <div className="text-zinc-300 font-mono text-[10px] break-all">{health.host}</div>
                </div>
                <div className="p-2 bg-zinc-800/30 rounded space-y-1">
                  <div className="text-zinc-400">Database:</div>
                  <div className="text-zinc-300 font-mono">{health.database}</div>
                </div>
                <div className="mt-2 text-center">
                  <span className={`text-xs px-2 py-1 rounded ${
                    health.connected
                      ? 'bg-emerald-900/30 text-emerald-400' 
                      : 'bg-red-900/30 text-red-400'
                  }`}>
                    {health.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowConfigDialog(true)}
                    className="flex-1 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs text-zinc-300 transition-colors flex items-center justify-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    Edit
                  </button>
                  {!health.connected && (
                    <button
                      onClick={initializeConnection}
                      className="flex-1 px-2 py-1.5 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700 rounded text-xs text-emerald-200 transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ) : connecting ? (
              <div className="text-xs text-zinc-500 text-center py-2">Connecting...</div>
            ) : (
              <div className="text-xs text-zinc-500 text-center py-2">
                <button
                  onClick={() => setShowConfigDialog(true)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Configure Connection
                </button>
              </div>
            )}
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
                  {type}
                  {type !== 'all' && (
                    <span className="text-xs ml-2 opacity-60">
                      ({documents.filter(d => d.doc_type === type).length})
                    </span>
                  )}
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
                placeholder="Search documents (semantic search)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              <button
                onClick={handleSearch}
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
              {filteredDocs.map((doc) => (
                <div
                  key={doc.document_id}
                  onClick={() => handleViewDocument(doc)}
                  className="p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-lg hover:bg-zinc-800/60 hover:border-zinc-600 cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-zinc-200 flex-1">{doc.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded border ${getTypeColor(doc.doc_type)}`}>
                      {doc.doc_type}
                    </span>
                  </div>
                  
                  <div className="text-xs text-zinc-400 space-y-1">
                    {doc.domain && <div>Domain: {doc.domain}</div>}
                    {doc.project_name && <div>Project: {doc.project_name}</div>}
                    {doc.session_id && (
                      <div className="font-mono">Session: {doc.session_id.slice(0, 8)}...</div>
                    )}
                    <div>Created: {new Date(doc.created_at).toLocaleString()}</div>
                  </div>

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {doc.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 bg-zinc-700/50 rounded text-zinc-300">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {doc.is_large && (
                    <div className="mt-2 text-xs text-orange-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Large document (stored as file)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedDoc && (
        <RecordDetailPanel
          record={selectedDoc}
          tableName="documents"
          onClose={() => setSelectedDoc(null)}
        />
      )}

      {/* Config Dialog */}
      {showConfigDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl p-6 mx-4">
            <h3 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
              <DatabaseIcon className="w-5 h-5" />
              PostgreSQL Connection
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Host</label>
                <input
                  type="text"
                  value={config.host}
                  onChange={(e) => setConfig({...config, host: e.target.value})}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Port</label>
                  <input
                    type="number"
                    value={config.port}
                    onChange={(e) => setConfig({...config, port: parseInt(e.target.value) || 5432})}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Database</label>
                  <input
                    type="text"
                    value={config.database}
                    onChange={(e) => setConfig({...config, database: e.target.value})}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-900"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">User</label>
                <input
                  type="text"
                  value={config.user}
                  onChange={(e) => setConfig({...config, user: e.target.value})}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-900"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Password</label>
                <input
                  type="password"
                  value={config.password}
                  onChange={(e) => setConfig({...config, password: e.target.value})}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowConfigDialog(false)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfigDialog(false);
                  initializeConnection();
                }}
                className="px-4 py-2 bg-emerald-900 text-emerald-100 rounded hover:bg-emerald-800 transition-colors flex items-center gap-2"
              >
                <Server className="w-4 h-4" />
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
