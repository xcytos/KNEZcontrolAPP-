import React from 'react';
import { Filter } from 'lucide-react';
import { NodeStatus } from './knezArchitecture';

interface StatusFilterProps {
  currentFilter: NodeStatus | 'all';
  onFilterChange: (filter: NodeStatus | 'all') => void;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  currentFilter,
  onFilterChange
}) => {
  const filters: Array<{ value: NodeStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'working', label: 'Working' },
    { value: 'partial', label: 'Partial' },
    { value: 'not_working', label: 'Not Working' },
    { value: 'planned', label: 'Planned' }
  ];

  return (
    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
      <Filter size={16} className="text-zinc-500" />
      <select
        value={currentFilter}
        onChange={(e) => onFilterChange(e.target.value as NodeStatus | 'all')}
        className="bg-transparent text-xs text-zinc-400 border-none outline-none cursor-pointer"
      >
        {filters.map((filter) => (
          <option key={filter.value} value={filter.value}>
            {filter.label}
          </option>
        ))}
      </select>
    </div>
  );
};
