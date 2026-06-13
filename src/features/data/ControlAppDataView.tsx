import React, { useEffect, useState } from 'react';
import { db } from '../../services/session/SessionDatabase';
import { Table, FileText, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { RecordDetailPanel } from './components/RecordDetailPanel';

type Table = 'sessions' | 'messages' | 'assistantMessages' | 'outgoingQueue';

interface TableStats {
  name: string;
  count: number;
  icon: React.FC<any>;
  description: string;
}

export const ControlAppDataView: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<Table>('sessions');
  const [stats, setStats] = useState<TableStats[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable);
    }
  }, [selectedTable]);

  const loadStats = async () => {
    try {
      const [sessionsCount, messagesCount, assistantCount, queueCount] = await Promise.all([
        db.sessions.count(),
        db.messages.count(),
        db.assistantMessages.count(),
        db.outgoingQueue.count(),
      ]);

      setStats([
        {
          name: 'sessions',
          count: sessionsCount,
          icon: FileText,
          description: 'Chat sessions and metadata',
        },
        {
          name: 'messages',
          count: messagesCount,
          icon: MessageSquare,
          description: 'User and system messages',
        },
        {
          name: 'assistantMessages',
          count: assistantCount,
          icon: MessageSquare,
          description: 'Assistant responses with blocks',
        },
        {
          name: 'outgoingQueue',
          count: queueCount,
          icon: AlertCircle,
          description: 'Pending message queue',
        },
      ]);
    } catch (err) {
      console.error('[ControlAppDataView] Failed to load stats:', err);
      setError('Failed to load table statistics');
    }
  };

  const loadTableData = async (table: Table) => {
    setLoading(true);
    setError(null);
    try {
      let records: any[] = [];
      switch (table) {
        case 'sessions':
          records = await db.sessions.orderBy('updatedAt').reverse().limit(100).toArray();
          break;
        case 'messages':
          records = await db.messages.orderBy('createdAt').reverse().limit(100).toArray();
          break;
        case 'assistantMessages':
          records = await db.assistantMessages.orderBy('createdAt').reverse().limit(100).toArray();
          break;
        case 'outgoingQueue':
          records = await db.outgoingQueue.toArray();
          break;
      }
      setData(records);
    } catch (err) {
      console.error(`[ControlAppDataView] Failed to load ${table}:`, err);
      setError(`Failed to load ${table} data`);
    } finally {
      setLoading(false);
    }
  };

  const renderTablePreview = (record: any, table: Table) => {
    switch (table) {
      case 'sessions':
        return (
          <div className="space-y-1">
            <div className="font-medium text-zinc-200">{record.name || record.id}</div>
            <div className="text-xs text-zinc-400">
              Created: {new Date(record.createdAt).toLocaleString()}
            </div>
            {record.tags && record.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                {record.tags.slice(0, 3).map((tag: string, idx: number) => (
                  <span key={idx} className="text-xs px-2 py-0.5 bg-zinc-700/50 rounded text-zinc-300">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      case 'messages':
        return (
          <div className="space-y-1">
            <div className="text-sm text-zinc-300 line-clamp-2">{record.text}</div>
            <div className="text-xs text-zinc-400 flex gap-3">
              <span>From: {record.from}</span>
              <span>{new Date(record.createdAt).toLocaleString()}</span>
            </div>
          </div>
        );
      case 'assistantMessages':
        return (
          <div className="space-y-1">
            <div className="text-xs text-zinc-400">
              {record.blocks?.length || 0} blocks • State: {record.state}
            </div>
            <div className="text-xs text-zinc-500">
              {new Date(record.createdAt).toLocaleString()}
            </div>
          </div>
        );
      case 'outgoingQueue':
        return (
          <div className="space-y-1">
            <div className="text-sm text-zinc-300 line-clamp-1">{record.text}</div>
            <div className="text-xs text-zinc-400 flex gap-3">
              <span className={`
                px-2 py-0.5 rounded
                ${record.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' : ''}
                ${record.status === 'in_flight' ? 'bg-blue-900/30 text-blue-400' : ''}
                ${record.status === 'failed' ? 'bg-red-900/30 text-red-400' : ''}
              `}>
                {record.status}
              </span>
              <span>Attempts: {record.attempts}</span>
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
                  onClick={() => setSelectedTable(stat.name as Table)}
                  className={`
                    w-full text-left p-3 rounded-lg border transition-all duration-200
                    ${isActive 
                      ? 'bg-blue-900/30 border-blue-700 text-blue-200' 
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
                    {stat.count.toLocaleString()} records
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
              <Table className="w-5 h-5" />
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
            <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
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
    </div>
  );
};
