import React, { useState } from 'react';
import { X, Activity, Network, Download, CheckSquare } from 'lucide-react';
import { EventTypeFilters, ExportFormat } from '../types/SessionFullViewTypes';

interface FullViewHeaderProps {
  activeView: 'timeline' | 'graph';
  onViewChange: (view: 'timeline' | 'graph') => void;
  filters: EventTypeFilters;
  onFilterChange: (filters: EventTypeFilters) => void;
  onExport: (format: 'json' | 'markdown') => void;
  onClose: () => void;
}

export const FullViewHeader: React.FC<FullViewHeaderProps> = ({
  activeView,
  onViewChange,
  filters,
  onFilterChange,
  onExport,
  onClose,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const exportFormats: ExportFormat[] = [
    { type: 'json', label: 'Export as JSON' },
    { type: 'markdown', label: 'Export as Markdown' },
  ];

  return (
    <div className="h-16 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: Tab Switcher */}
      <div className="flex items-center gap-1">
        <TabButton
          active={activeView === 'timeline'}
          onClick={() => onViewChange('timeline')}
          icon={Activity}
          label="Timeline"
        />
        <TabButton
          active={activeView === 'graph'}
          onClick={() => onViewChange('graph')}
          icon={Network}
          label="Relationship Graph"
        />
      </div>

      {/* Center: Filters (Only for Timeline View) */}
      {activeView === 'timeline' && (
        <div className="flex items-center gap-3">
          <FilterToggle
            label="Checkpoints"
            active={filters.checkpoints}
            onChange={(v) => onFilterChange({ ...filters, checkpoints: v })}
            color="blue"
          />
          <FilterToggle
            label="Events"
            active={filters.events}
            onChange={(v) => onFilterChange({ ...filters, events: v })}
            color="purple"
          />
          <FilterToggle
            label="Decisions"
            active={filters.decisions}
            onChange={(v) => onFilterChange({ ...filters, decisions: v })}
            color="orange"
          />
          <FilterToggle
            label="Insights"
            active={filters.insights}
            onChange={(v) => onFilterChange({ ...filters, insights: v })}
            color="yellow"
          />
          <FilterToggle
            label="Files"
            active={filters.files}
            onChange={(v) => onFilterChange({ ...filters, files: v })}
            color="cyan"
          />
          <FilterToggle
            label="Documents"
            active={filters.documents}
            onChange={(v) => onFilterChange({ ...filters, documents: v })}
            color="pink"
          />
        </div>
      )}

      {/* Right: Export & Close */}
      <div className="flex items-center gap-2">
        {/* Export Button with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm flex items-center gap-2 transition-colors"
            title="Export Session"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          {exportMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setExportMenuOpen(false)}
              />

              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50">
                {exportFormats.map((format) => (
                  <button
                    key={format.type}
                    onClick={() => {
                      onExport(format.type);
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-800 rounded transition-colors"
          title="Close (ESC)"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>
    </div>
  );
};

// TabButton Component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 flex items-center gap-2 text-sm font-medium rounded transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-transparent text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
};

// FilterToggle Component
interface FilterToggleProps {
  label: string;
  active: boolean;
  onChange: (active: boolean) => void;
  color: string;
}

const FilterToggle: React.FC<FilterToggleProps> = ({ label, active, onChange, color }) => {
  const colorClasses: Record<string, string> = {
    blue: 'border-blue-600 bg-blue-600/20 text-blue-300',
    purple: 'border-purple-600 bg-purple-600/20 text-purple-300',
    orange: 'border-orange-600 bg-orange-600/20 text-orange-300',
    yellow: 'border-yellow-600 bg-yellow-600/20 text-yellow-300',
    cyan: 'border-cyan-600 bg-cyan-600/20 text-cyan-300',
    pink: 'border-pink-600 bg-pink-600/20 text-pink-300',
  };

  const inactiveClass = 'border-zinc-700 bg-zinc-800/50 text-zinc-500';
  const classes = active ? colorClasses[color] : inactiveClass;

  return (
    <button
      onClick={() => onChange(!active)}
      className={`px-2 py-1 text-xs font-medium rounded border flex items-center gap-1.5 transition-all hover:opacity-80 ${classes}`}
      title={`Toggle ${label}`}
    >
      <CheckSquare className={`w-3 h-3 ${active ? '' : 'opacity-50'}`} />
      <span>{label}</span>
    </button>
  );
};
