import React from 'react';
import { getStatusColor, getStatusLabel } from './knezArchitecture';

export const LayerLegend: React.FC = () => {
  const statuses: Array<'working' | 'partial' | 'not_working' | 'planned'> = [
    'working',
    'partial',
    'not_working',
    'planned'
  ];

  return (
    <div className="flex items-center gap-6 text-xs">
      {statuses.map((status) => (
        <div key={status} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
          <span className="text-zinc-500">{getStatusLabel(status)}</span>
        </div>
      ))}
    </div>
  );
};
