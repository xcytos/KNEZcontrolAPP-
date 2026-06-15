import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, AlertCircle, FolderOpen, Table2, Edit2, Trash2, Save, X } from 'lucide-react';
import { genericSqliteService } from '../../services/data/GenericSqliteService';
import { RecordDetailPanel } from './components/RecordDetailPanel';
import { open } from '@tauri-apps/plugin-dialog';

interface TableStats {
  name: string;
  rowCount: number;
}

interface SqliteBrowserState {
  tableName?: string;
  filter?: string;
  issueType?: string;
}

interface GenericSqliteViewProps {
  initialState?: SqliteBrowserState;
  onClearState?: () => void;
}

export const GenericSqliteView: React.FC<GenericSqliteViewProps> = ({ initialState, onClearState }) => {
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
  const [filterApplied, setFilterApplied] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<string | null>(null);
  const [isOrphanedData, setIsOrphanedData] = useState<boolean>(false);
  
  // Edit/Delete state
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editColumn, setEditColumn] = useState<string>('');
  const [editValue, setEditValue] = useState<string>('');
  const [deletingRecord, setDeletingRecord] = useState<any | null>(null);
  const [linkingRecord, setLinkingRecord] = useState<any | null>(null);
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pkColumn, setPkColumn] = useState<string>('');
  
  // Bulk operations state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState<boolean>(false);

  useEffect(() => {
    // Set default path to TAQWIN home database (where checkpoints actually are!)
    const defaultPath = 'C:\\Users\\syedm\\taqwin_memory.db';
    handleSetPath(defaultPath);
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable);
    }
  }, [selectedTable, filterApplied]); // Re-load when filter changes

  // Handle initial state from navigation
  useEffect(() => {
    if (initialState && dbPath && tables.length > 0) {
      if (initialState.tableName) {
        setSelectedTable(initialState.tableName);
      }
      setFilterApplied(initialState.filter || null);
      setIssueType(initialState.issueType || null);
      
      // Check if this is orphaned data (checkpoints or events without sessions)
      const isOrphaned = initialState.issueType?.toLowerCase().includes('orphaned') || false;
      setIsOrphanedData(isOrphaned);
      
      // Load available sessions if orphaned data
      if (isOrphaned) {
        loadAvailableSessions();
      }
    }
  }, [initialState, dbPath, tables]);

  const loadAvailableSessions = async () => {
    try {
      const query = 'SELECT session_id, display_id, name, created_at FROM sessions ORDER BY created_at DESC LIMIT 100';
      const result = await genericSqliteService.executeQuery(query);
      setAvailableSessions(result || []);
    } catch (err) {
      console.error('[GenericSqliteView] Failed to load sessions:', err);
    }
  };

  const loadAvailableProjects = async () => {
    try {
      const query = 'SELECT project_id, project_name, project_path, created_at FROM projects ORDER BY created_at DESC';
      const result = await genericSqliteService.executeQuery(query);
      setAvailableProjects(result || []);
    } catch (err) {
      console.error('[GenericSqliteView] Failed to load projects:', err);
    }
  };

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
    
    // Store scroll position before reload
    const tableContainer = document.querySelector('.data-grid-container');
    const scrollPos = tableContainer?.scrollTop || 0;
    
    try {
      // Get table schema
      const tableInfo = await genericSqliteService.getTableInfo(tableName);
      const columnNames = tableInfo.map(col => col.name);
      setColumns(columnNames);
      
      // Find primary key column
      const pkCol = tableInfo.find(col => col.pk === 1);
      setPkColumn(pkCol?.name || columnNames[0] || 'id');
      
      // Query table data - apply filter if provided AND validate columns exist
      let records: any[];
      if (filterApplied) {
        // Validate that all columns in filter exist in the table
        const filterValid = validateFilterColumns(filterApplied, columnNames);
        
        if (filterValid) {
          // Execute filtered query
          const query = `SELECT * FROM ${tableName} WHERE ${filterApplied} LIMIT 100`;
          const result = await genericSqliteService.executeQuery(query);
          records = result || [];
        } else {
          // Filter references columns not in this table, clear filter and load all
          console.warn(`[GenericSqliteView] Filter contains columns not in ${tableName}, clearing filter`);
          setFilterApplied(null);
          setIssueType(null);
          records = await genericSqliteService.queryTable(tableName, 100);
        }
      } else {
        records = await genericSqliteService.queryTable(tableName, 100);
      }
      
      setData(records);
      
      // Restore scroll position after render
      setTimeout(() => {
        if (tableContainer) {
          tableContainer.scrollTop = scrollPos;
        }
      }, 0);
    } catch (err: any) {
      console.error(`[GenericSqliteView] Failed to load ${tableName}:`, err);
      setError(err?.message || `Failed to load ${tableName} data`);
      setData([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  const validateFilterColumns = (filter: string, tableColumns: string[]): boolean => {
    // Extract column names from filter (improved regex)
    // Match column names that are followed by operators or used in comparisons
    // Examples: column_name IS, column_name =, column_name IN, column NOT
    const columnPattern = /\b([a-z_][a-z0-9_]*)\s*(?:IS|=|IN|NOT|<|>|LIKE)/gi;
    const columnMatches = filter.match(columnPattern);
    
    if (!columnMatches) return true; // No columns found, assume valid
    
    // Extract just the column name (before the operator)
    const sqlKeywords = new Set(['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'LIMIT', 'ORDER', 'BY', 'ASC', 'DESC']);
    
    for (const match of columnMatches) {
      // Extract column name (everything before the operator)
      const col = match.trim().split(/\s+/)[0];
      const colUpper = col.toUpperCase();
      
      if (!sqlKeywords.has(colUpper) && !tableColumns.includes(col)) {
        console.warn(`[GenericSqliteView] Column '${col}' not found in table columns:`, tableColumns);
        return false;
      }
    }
    
    return true;
  };

  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setEditColumn(columns[0] || '');
    setEditValue(String(record[columns[0]] || ''));
  };

  const handleSaveEdit = async () => {
    if (!editingRecord || !editColumn || !selectedTable) return;
    
    try {
      setLoading(true);
      const pkValue = String(editingRecord[pkColumn]);
      await genericSqliteService.updateRow(
        selectedTable,
        pkColumn,
        pkValue,
        editColumn,
        editValue
      );
      
      // Reload data
      await loadTableData(selectedTable);
      setEditingRecord(null);
      setError(null);
    } catch (err: any) {
      setError(`Failed to update: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord || !selectedTable) return;
    
    try {
      setLoading(true);
      const pkValue = String(deletingRecord[pkColumn]);
      await genericSqliteService.deleteRow(selectedTable, pkColumn, pkValue);
      
      // Reload data
      await loadTableData(selectedTable);
      setDeletingRecord(null);
      setError(null);
    } catch (err: any) {
      setError(`Failed to delete: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0 || !selectedTable) return;
    
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedRows.size} records? This action cannot be undone.`);
    if (!confirmDelete) return;
    
    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;
      
      for (const pkValue of selectedRows) {
        try {
          await genericSqliteService.deleteRow(selectedTable, pkColumn, pkValue);
          successCount++;
        } catch (err) {
          console.error(`Failed to delete row ${pkValue}:`, err);
          errorCount++;
        }
      }
      
      // Clear selection and reload
      setSelectedRows(new Set());
      setBulkActionMode(false);
      await loadTableData(selectedTable);
      
      if (errorCount > 0) {
        setError(`Deleted ${successCount} records, ${errorCount} failed`);
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(`Bulk delete failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkLink = async () => {
    if (selectedRows.size === 0 || !selectedTable) return;
    
    // Open a dialog to select session
    const sessionId = prompt('Enter session ID to link all selected records:');
    if (!sessionId) return;
    
    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;
      
      for (const pkValue of selectedRows) {
        try {
          await genericSqliteService.updateRow(
            selectedTable,
            pkColumn,
            pkValue,
            'session_id',
            sessionId
          );
          successCount++;
        } catch (err) {
          console.error(`Failed to link row ${pkValue}:`, err);
          errorCount++;
        }
      }
      
      // Clear selection and reload
      setSelectedRows(new Set());
      setBulkActionMode(false);
      await loadTableData(selectedTable);
      
      if (errorCount > 0) {
        setError(`Linked ${successCount} records, ${errorCount} failed`);
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(`Bulk link failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleRowSelection = (pkValue: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(pkValue)) {
      newSelection.delete(pkValue);
    } else {
      newSelection.add(pkValue);
    }
    setSelectedRows(newSelection);
    setBulkActionMode(newSelection.size > 0);
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === data.length) {
      // Deselect all
      setSelectedRows(new Set());
      setBulkActionMode(false);
    } else {
      // Select all
      const allPks = new Set(data.map(record => String(record[pkColumn])));
      setSelectedRows(allPks);
      setBulkActionMode(true);
    }
  };

  const handleLinkToSession = async () => {
    const linkId = selectedTable === 'sessions' ? selectedProjectId : selectedSessionId;
    const linkColumn = selectedTable === 'sessions' ? 'project_id' : 'session_id';
    
    if (!linkingRecord || !linkId || !selectedTable) return;
    
    try {
      setLoading(true);
      const pkValue = String(linkingRecord[pkColumn]);
      
      await genericSqliteService.updateRow(
        selectedTable,
        pkColumn,
        pkValue,
        linkColumn,
        linkId
      );
      
      // Reload data
      await loadTableData(selectedTable);
      setLinkingRecord(null);
      setSelectedSessionId('');
      setSelectedProjectId('');
      setError(null);
    } catch (err: any) {
      setError(`Failed to link: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilter = () => {
    setFilterApplied(null);
    setIssueType(null);
    setIsOrphanedData(false);
    if (onClearState) {
      onClearState();
    }
    if (selectedTable) {
      loadTableData(selectedTable);
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
        {/* Issue Type Banner */}
        {issueType && (
          <div className="px-6 py-3 bg-yellow-900/20 border-b border-yellow-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-yellow-200">
                <strong>Data Integrity Issue:</strong> {issueType}
              </span>
              {filterApplied && (
                <span className="text-xs text-yellow-400/70 font-mono ml-2">
                  Filter: {filterApplied}
                </span>
              )}
            </div>
            <button
              onClick={handleClearFilter}
              className="text-xs text-yellow-400 hover:text-yellow-300 underline"
            >
              Clear Filter
            </button>
          </div>
        )}

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
        <div className="flex-1 overflow-auto p-4 data-grid-container">
          {/* Bulk Action Bar */}
          {bulkActionMode && selectedRows.size > 0 && (
            <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-200">
                  {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => {
                    setSelectedRows(new Set());
                    setBulkActionMode(false);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Clear Selection
                </button>
              </div>
              <div className="flex items-center gap-2">
                {isOrphanedData && (
                  <button
                    onClick={handleBulkLink}
                    className="px-3 py-1.5 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Link Selected
                  </button>
                )}
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-red-900 text-red-100 rounded hover:bg-red-800 transition-colors text-sm flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
              </div>
            </div>
          )}

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
                    {/* Checkbox Column */}
                    <th className="px-4 py-2 text-left border-b border-zinc-700">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === data.length && data.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900"
                      />
                    </th>
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
                  {data.map((record, idx) => {
                    const rowPk = String(record[pkColumn]);
                    const isSelected = selectedRows.has(rowPk);
                    
                    return (
                      <tr 
                        key={idx} 
                        className={`border-b border-zinc-800/50 transition-colors ${
                          isSelected ? 'bg-blue-900/20' : 'hover:bg-zinc-800/30'
                        }`}
                      >
                        {/* Checkbox Cell */}
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(rowPk)}
                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900"
                          />
                        </td>
                        {columns.map((col) => (
                          <td key={col} className="px-4 py-2 text-zinc-300 font-mono text-xs">
                            <div className="max-w-xs truncate" title={renderCellValue(record[col])}>
                              {renderCellValue(record[col])}
                            </div>
                          </td>
                        ))}
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedRecord(record)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              View
                            </button>
                            {/* Link button for sessions without projects */}
                            {selectedTable === 'sessions' && (!record.project_id || record.project_id === '') && (
                              <button
                                onClick={() => {
                                  setLinkingRecord(record);
                                  loadAvailableProjects();
                                }}
                                className="p-1 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded transition-colors"
                                title="Link to project"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                            )}
                            {/* Link button for orphaned checkpoints/events */}
                            {isOrphanedData && (
                              <button
                                onClick={() => setLinkingRecord(record)}
                                className="p-1 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded transition-colors"
                                title="Link to session"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleEditRecord(record)}
                              className="p-1 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20 rounded transition-colors"
                              title="Edit record"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingRecord(record)}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Edit Record Dialog */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-3xl p-6 mx-4">
            <div className="flex items-center gap-2 mb-4">
              <Edit2 className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-zinc-200">Edit Record</h3>
            </div>
            
            <div className="mb-4 p-3 bg-zinc-800/50 border border-zinc-700 rounded">
              <div className="text-xs text-zinc-400 mb-1">Primary Key: {pkColumn}</div>
              <div className="text-sm text-zinc-200 font-mono">
                {renderCellValue(editingRecord[pkColumn])}
              </div>
            </div>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Column to Edit
                </label>
                <select
                  value={editColumn}
                  onChange={(e) => {
                    setEditColumn(e.target.value);
                    setEditValue(String(editingRecord[e.target.value] || ''));
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:outline-none focus:ring-2 focus:ring-yellow-900 font-mono text-sm"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  New Value
                </label>
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-900 font-mono text-sm"
                  placeholder="Enter new value..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-yellow-900 text-yellow-100 rounded hover:bg-yellow-800 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl p-6 mx-4">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-semibold text-zinc-200">Delete Record</h3>
            </div>
            
            <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded">
              <p className="text-sm text-red-200 mb-3">
                Are you sure you want to delete this record? This action cannot be undone.
              </p>
              <div className="text-xs text-zinc-400 mb-1">Primary Key: {pkColumn}</div>
              <div className="text-sm text-zinc-200 font-mono">
                {renderCellValue(deletingRecord[pkColumn])}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingRecord(null)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRecord}
                className="px-4 py-2 bg-red-900 text-red-100 rounded hover:bg-red-800 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Dialog (Session or Project) */}
      {linkingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl p-6 mx-4">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <h3 className="text-lg font-semibold text-zinc-200">
                Link to {selectedTable === 'sessions' ? 'Project' : 'Session'}
              </h3>
            </div>
            
            <div className="mb-4 p-3 bg-green-900/20 border border-green-800 rounded">
              <div className="text-xs text-zinc-400 mb-1">Current {pkColumn}:</div>
              <div className="text-sm text-zinc-200 font-mono mb-3">
                {renderCellValue(linkingRecord[pkColumn])}
              </div>
              <div className="text-xs text-green-300">
                Select a {selectedTable === 'sessions' ? 'project' : 'session'} to link this {selectedTable?.slice(0, -1)} to:
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {selectedTable === 'sessions' ? 'Available Projects' : 'Available Sessions'}
              </label>
              {selectedTable === 'sessions' ? (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:outline-none focus:ring-2 focus:ring-green-900 font-mono text-sm max-h-60"
                  size={Math.min(availableProjects.length + 1, 8)}
                >
                  <option value="">-- Select Project --</option>
                  {availableProjects.map((project) => (
                    <option key={project.project_id} value={project.project_id}>
                      {project.project_name} - {project.project_path}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:outline-none focus:ring-2 focus:ring-green-900 font-mono text-sm max-h-60"
                  size={Math.min(availableSessions.length + 1, 8)}
                >
                  <option value="">-- Select Session --</option>
                  {availableSessions.map((session) => (
                    <option key={session.session_id} value={session.session_id}>
                      {session.display_id || session.session_id.substring(0, 8)} - {session.name || 'Unnamed'} ({new Date(session.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setLinkingRecord(null);
                  setSelectedSessionId('');
                  setSelectedProjectId('');
                }}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkToSession}
                disabled={selectedTable === 'sessions' ? !selectedProjectId : !selectedSessionId}
                className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Link to {selectedTable === 'sessions' ? 'Project' : 'Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
