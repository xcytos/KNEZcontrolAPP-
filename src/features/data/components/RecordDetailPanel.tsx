import React, { useState } from 'react';
import { X, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface RecordDetailPanelProps {
  record: any;
  tableName: string;
  onClose: () => void;
}

export const RecordDetailPanel: React.FC<RecordDetailPanelProps> = ({ record, tableName, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const renderValue = (value: any, depth = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-zinc-500 italic">null</span>;
    }

    if (typeof value === 'boolean') {
      return <span className={value ? 'text-green-400' : 'text-red-400'}>{String(value)}</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-blue-400">{value}</span>;
    }

    if (typeof value === 'string') {
      // Handle long strings
      if (value.length > 200) {
        return (
          <div className="bg-zinc-900/50 p-2 rounded border border-zinc-700 max-h-64 overflow-y-auto">
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words font-mono">
              {value}
            </pre>
          </div>
        );
      }
      return <span className="text-zinc-300">{value}</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-zinc-500">[]</span>;
      }
      return (
        <div className="space-y-1 ml-4">
          {value.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-zinc-500">[{idx}]</span>
              {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-zinc-500">{'{}'}</span>;
      }
      
      if (depth > 2) {
        // Prevent deep nesting, show collapsed JSON
        return (
          <div className="bg-zinc-900/50 p-2 rounded border border-zinc-700 max-h-32 overflow-y-auto">
            <pre className="text-xs text-zinc-400 font-mono">
              {JSON.stringify(value, null, 2)}
            </pre>
          </div>
        );
      }

      return (
        <div className="space-y-1 ml-4 border-l-2 border-zinc-700/50 pl-3">
          {entries.map(([key, val]) => (
            <div key={key} className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-zinc-400 text-sm font-mono truncate">{key}:</span>
              <div>{renderValue(val, depth + 1)}</div>
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-zinc-400">{String(value)}</span>;
  };

  const mainFields = Object.entries(record).filter(([key]) => 
    !['metadata', 'context', 'blocks', 'toolCall', 'metrics'].includes(key)
  );

  const nestedFields = Object.entries(record).filter(([key]) => 
    ['metadata', 'context', 'blocks', 'toolCall', 'metrics'].includes(key) && record[key]
  );

  return (
    <div className="w-96 border-l border-zinc-800 bg-zinc-900/50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
        <h3 className="font-semibold text-zinc-200">Record Details</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
            title="Copy as JSON"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-zinc-400" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Table Info */}
          <div className="text-xs text-zinc-500 mb-4">
            Table: <span className="font-mono text-zinc-400">{tableName}</span>
          </div>

          {/* Main Fields */}
          <div className="space-y-3">
            <button
              onClick={() => toggleSection('main')}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-zinc-200"
            >
              {expandedSections.has('main') ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Main Fields
            </button>

            {expandedSections.has('main') && (
              <div className="space-y-2">
                {mainFields.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-zinc-400 text-sm font-mono truncate">{key}:</span>
                    <div className="min-w-0">{renderValue(value)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nested Fields */}
          {nestedFields.map(([key, value]) => (
            <div key={key} className="space-y-3">
              <button
                onClick={() => toggleSection(key)}
                className="flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-zinc-200"
              >
                {expandedSections.has(key) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                {key}
              </button>

              {expandedSections.has(key) && (
                <div>{renderValue(value)}</div>
              )}
            </div>
          ))}

          {/* Raw JSON (collapsed by default) */}
          <div className="space-y-3 mt-6">
            <button
              onClick={() => toggleSection('raw')}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-zinc-200"
            >
              {expandedSections.has('raw') ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Raw JSON
            </button>

            {expandedSections.has('raw') && (
              <div className="bg-zinc-950 p-3 rounded border border-zinc-800 max-h-96 overflow-y-auto">
                <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(record, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
