import React from 'react';
import { PresenceState } from '../../domain/DataContracts';

interface PresenceIndicatorProps {
  state: PresenceState;
}

const stateConfig: Record<PresenceState, { color: string; label: string; description: string }> = {
  SILENT: {
    color: 'bg-gray-500',
    label: 'Silent',
    description: 'KNEZ is dormant.',
  },
  OBSERVING: {
    color: 'bg-blue-500',
    label: 'Observing',
    description: 'KNEZ is watching and listening.',
  },
  REFLECTING: {
    color: 'bg-purple-500',
    label: 'Reflecting',
    description: 'KNEZ is processing patterns.',
  },
  RESPONDING: {
    color: 'bg-green-500',
    label: 'Responding',
    description: 'KNEZ is speaking.',
  },
};

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ state }) => {
  const config = stateConfig[state];

  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 shadow-sm" title={config.description}>
      <div className={`w-2.5 h-2.5 rounded-full ${config.color} animate-pulse`} />
      <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">{config.label}</span>
    </div>
  );
};
