import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, AlertCircle, FileText, FolderOpen } from 'lucide-react';
import { sqliteService } from '../../services/data/DatabaseService';
import { RecordDetailPanel } from './components/RecordDetailPanel';
import { open } from '@tauri-apps/plugin-dialog';

type TaqwinTable = 'sessions' | 'memories' | 'checkpoints';

interface TableStats {
  name: TaqwinTable;
  count: number;
  icon: React.FC<any>;
  description: string;
}

export const SqliteDataView: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<TaqwinTable>('sessions');
  const [stats, setStats] = useState<TableStats[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [showPathDialog, setShowPathDialog] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [dbPath, setDbPath] = useState<string>('');

  useEffect(() => {
    // Set default path to TAQWIN MCP server database
    const defaultPath = 'C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\TAQWIN_V1\\TAQWIN-MCP-SERVER\\taqwin_memory.db';
    sqliteService.setDatabasePath(defaultPath);
    setDbPath(defaultPath);
    loadStats();
  }, []);

  useEffect(() => {
    loadTableData(selectedTable);
  }, [selectedTable]);

  const loadStats = async () => {
    try {
      // TAQWIN schema only has sessions table, no memories/checkpoints in SQLite
      const sessions = await sqliteService.listSessions(1000);
      const sessionCount = sessions.length;

      setStats([
        {
          name: 'sessions',
          count: sessionCount,
          icon: FileText,
          description: 'TAQWIN sessions (from SQLite)',
        },
      ]);

      setDbPath(sqliteService.getDatabasePath());
    } catch (err) {
      console.error('[SqliteDataView] Failed to load stats:', err);
      setError('Failed to load statistics. Database may not exist or be inaccessible.');
      setDbPath(sqliteService.getDatabasePath());
    }
  };

  const handleSelectDatabase = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'SQLite Database',
          extensions: ['db', 'sqlite', 'sqlite3']
        }]
      });

      if (selected && typeof selected === 'string') {
        sqliteService.setDatabasePath(selected);
        setDbPath(selected);
        setError(null);
        await loadStats();
        if (selectedTable) {
          await loadTableData(selectedTable);
        }
      }
    } catch (err) {
      console.error('[SqliteDataView] File picker error:', err);
      setError('Failed to open file picker');
    }
  };

  const handleSetCustomPath = () => {
    if (customPath.trim()) {
      sqliteService.setDatabasePath(customPath);
      setDbPath(customPath);
      setShowPathDialog(false);
      setError(null);
      loadStats();
      if (selectedTable) {
        loadTableData(selectedTable);
      }
    }
  };

  const loadTableData = async (table: TaqwinTable) => {
    setLoading(true);
    setError(null);
    try {
      let records: any[] = [];

      if (table === 'sessions') {
        records = await sqliteService.listSessions(100);
      } else {
        // memories and checkpoints don't exist in TAQWIN SQLite schema
        setError(`Table "${table}" does not exist in TAQWIN SQLite database. Checkpoints are stored in PostgreSQL.`);
        records = [];
      }

      setData(records);
    } catch (err: any) {
      console.error(`[SqliteDataView] Failed to load ${table}:`, err);
      setError(err?.message || `Failed to load ${table} data`);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const renderTablePreview = (record: any, table: TaqwinTable) => {
    switch (table) {
      case 'sessions':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-500">{record.display_id}</span>
              <span className="font-medium text-zinc-200">{record.name}</span>
            </div>
            <div className="text-xs text-zinc-400">
              Type: {record.session_type} • Status: {record.status}
            </div>
            <div className="text-xs text-zinc-500">
              {new Date(record.created_at).toLocaleString()}
            </div>
            {record.tags && (
              <div className="flex gap-1 flex-wrap mt-1">
                {JSON.parse(record.tags || '[]').slice(0, 3).map((tag: string, idx: number) => (
                  <span key={idx} className="text-xs px-2 py-0.5 bg-purple-900/30 rounded text-purple-300">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case 'memories':
        return (
          <div className="space-y-1">
            <div className="text-sm text-zinc-300 line-clamp-2">{record.content}</div>
            <div className="text-xs text-zinc-400 flex gap-3">
              <span>Type: {record.memory_type}</span>
              <span>Domain: {record.domain}</span>
              {record.importance && <span>Importance: {record.importance}/10</span>}
            </div>
          </div>
        );

      case 'checkpoints':
        const learned = JSON.parse(record.learned_memories || '[]');
        const decisions = JSON.parse(record.decisions || '[]');
        const findings = JSON.parse(record.findings || '[]');
        return (
          <div className="space-y-1">
            <div className="font-medium text-zinc-200">{record.title}</div>
            <div className="text-xs text-zinc-400">
              {learned.length} memories • 
              {decisions.length} decisions • 
              {findings.length} findings
            </div>
            <div className="text-xs text-zinc-500">
              {new Date(record.created_at).toLocaleString()}
            </div>
          </div>
        );

      default:
        return <div className="text-xs text-zinc-400">{JSON.stringify(record).slice(0, 100)}...</div>;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Table Selector */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/30 overflow-y-auto">
        <div className="p-4">
          {/* Database Info */}
          <div className="mb-4 p-3 bg-purple-900/20 border border-purple-800/50 rounded-lg">
            <div className="text-xs text-purple-300 font-semibold mb-2">SQLite Database</div>
            {dbPath ? (
              <div className="text-xs text-purple-400/70 font-mono break-all mb-2">{dbPath}</div>
            ) : (
              <div className="text-xs text-zinc-500 italic mb-2">No database selected</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSelectDatabase}
                className="flex-1 px-2 py-1.5 bg-purple-900/40 hover:bg-purple-900/60 border border-purple-700 rounded text-xs text-purple-200 transition-colors flex items-center justify-center gap-1"
              >
                <FolderOpen className="w-3 h-3" />
                Browse
              </button>
              <button
                onClick={() => setShowPathDialog(true)}
                className="flex-1 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs text-zinc-300 transition-colors"
              >
                Manual
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-300">Tables</h3>
            <button
              onClick={loadStats}
              className="p-1 hover:bg-zinc-800 rounded transition-colors"
              title="Refresh stats"
            >
              <RefreshCw className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          <div className="space-y-2">
            {stats.map((stat) => {
              const Icon = stat.icon;
              const isActive = selectedTable === stat.name;
              return (
                <button
                  key={stat.name}
                  onClick={() => setSelectedTable(stat.name)}
                  className={`
                    w-full text-left p-3 rounded-lg border transition-all duration-200
                    ${isActive 
                      ? 'bg-purple-900/30 border-purple-700 text-purple-200' 
                      : 'bg-zinc-800/30 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800/50'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{stat.name}</span>
                  </div>
                  <div className="text-xs opacity-75 mb-1">{stat.description}</div>
                  <div className="text-xs font-mono text-zinc-400">
                    {stat.count > 0 ? `${stat.count.toLocaleString()} records` : 'N/A'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content - Data List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
              <Database className="w-5 h-5" />
              {selectedTable}
            </h2>
            <div className="text-sm text-zinc-400">
              {loading ? 'Loading...' : `${data.length} records`}
            </div>
          </div>
        </div>

        {/* Data Grid */}
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
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              No records found in {selectedTable}
            </div>
          ) : (
            <div className="grid gap-3">
              {data.map((record, idx) => (
                <div
                  key={record.id || idx}
                  onClick={() => setSelectedRecord(record)}
                  className="p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-lg hover:bg-zinc-800/60 hover:border-zinc-600 cursor-pointer transition-all duration-200"
                >
                  {renderTablePreview(record, selectedTable)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedRecord && (
        <RecordDetailPanel
          record={selectedRecord}
          tableName={selectedTable}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      {/* Custom Path Dialog */}
      {showPathDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl p-6 mx-4">
            <h3 className="text-lg font-semibold text-zinc-200 mb-4">Enter Database Path</h3>
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="C:\path\to\database.db"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-900 font-mono text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowPathDialog(false)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetCustomPath}
                className="px-4 py-2 bg-purple-900 text-purple-100 rounded hover:bg-purple-800 transition-colors"
              >
                Set Path
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
