import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, AlertCircle, FolderOpen, Table2 } from 'lucide-react';
import { genericSqliteService } from '../../services/data/GenericSqliteService';
import { RecordDetailPanel } from './components/RecordDetailPanel';
import { open } from '@tauri-apps/plugin-dialog';

interface TableStats {
  name: string;
  rowCount: number;
}

export const GenericSqliteView: React.FC = () => {
  const [tables, setTables] = useState<TableStats[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [dbPath, setDbPath] = useState<string>('');
  const [showPathDialog, setShowPathDialog] = useState(false);
  const [customPath, setCustomPath] = useState('');

  useEffect(() => {
    // Set default path to TAQWIN home database (where checkpoints actually are!)
    const defaultPath = 'C:\\Users\\syedm\\taqwin_memory.db';
    handleSetPath(defaultPath);
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable);
    }
  }, [selectedTable]);

  const handleSetPath = async (path: string) => {
    genericSqliteService.setDatabasePath(path);
    setDbPath(path);
    setError(null);
    await loadTables();
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
        await handleSetPath(selected);
      }
    } catch (err) {
      console.error('[GenericSqliteView] File picker error:', err);
      setError('Failed to open file picker');
    }
  };

  const handleSetCustomPath = () => {
    if (customPath.trim()) {
      handleSetPath(customPath);
      setShowPathDialog(false);
    }
  };

  const loadTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const tableNames = await genericSqliteService.listTables();
      
      // Get row count for each table
      const tableStats: TableStats[] = [];
      for (const name of tableNames) {
        try {
          const count = await genericSqliteService.getRowCount(name);
          tableStats.push({ name, rowCount: count });
        } catch (err) {
          console.error(`Failed to get count for ${name}:`, err);
          tableStats.push({ name, rowCount: 0 });
        }
      }
      
      setTables(tableStats);
      
      // Auto-select first table
      if (tableStats.length > 0 && !selectedTable) {
        setSelectedTable(tableStats[0].name);
      }
    } catch (err: any) {
      console.error('[GenericSqliteView] Failed to load tables:', err);
      setError(err?.message || 'Failed to load tables from database');
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName: string) => {
    setLoading(true);
    setError(null);
    try {
      // Get table schema
      const tableInfo = await genericSqliteService.getTableInfo(tableName);
      const columnNames = tableInfo.map(col => col.name);
      setColumns(columnNames);
      
      // Query table data
      const records = await genericSqliteService.queryTable(tableName, 100);
      setData(records);
    } catch (err: any) {
      console.error(`[GenericSqliteView] Failed to load ${tableName}:`, err);
      setError(err?.message || `Failed to load ${tableName} data`);
      setData([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  const renderCellValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Table List */}
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
            <h3 className="text-sm font-semibold text-zinc-300">Tables ({tables.length})</h3>
            <button
              onClick={loadTables}
              className="p-1 hover:bg-zinc-800 rounded transition-colors"
              title="Refresh tables"
            >
              <RefreshCw className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          <div className="space-y-1">
            {tables.map((table) => {
              const isActive = selectedTable === table.name;
              return (
                <button
                  key={table.name}
                  onClick={() => setSelectedTable(table.name)}
                  className={`
                    w-full text-left p-2 rounded border transition-all duration-200 text-sm
                    ${isActive 
                      ? 'bg-purple-900/30 border-purple-700 text-purple-200' 
                      : 'bg-zinc-800/30 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800/50'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Table2 className="w-3 h-3" />
                    <span className="font-medium font-mono">{table.name}</span>
                  </div>
                  <div className="text-xs text-zinc-400 ml-5">
                    {table.rowCount.toLocaleString()} rows
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content - Data Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
              <Database className="w-5 h-5" />
              {selectedTable || 'Select a table'}
            </h2>
            <div className="text-sm text-zinc-400">
              {loading ? 'Loading...' : `${data.length} records`}
            </div>
          </div>
        </div>

        {/* Data Grid */}
        <div className="flex-1 overflow-auto p-4">
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
          ) : !selectedTable ? (
            <div className="text-center py-12 text-zinc-500">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              Select a table to view its data
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              No records in {selectedTable}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800/50 sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="px-4 py-2 text-left text-xs font-semibold text-zinc-300 border-b border-zinc-700">
                        {col}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-300 border-b border-zinc-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((record, idx) => (
                    <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      {columns.map((col) => (
                        <td key={col} className="px-4 py-2 text-zinc-300 font-mono text-xs">
                          <div className="max-w-xs truncate" title={renderCellValue(record[col])}>
                            {renderCellValue(record[col])}
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedRecord && (
        <RecordDetailPanel
          record={selectedRecord}
          tableName={selectedTable || ''}
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
