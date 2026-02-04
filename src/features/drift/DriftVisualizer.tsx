import React from 'react';
import { DriftMetric } from '../../domain/DataContracts';

const MOCK_DRIFT: DriftMetric[] = [
  {
    id: 'd1',
    dimension: 'scope',
    value: 0.15,
    label: 'Scope Variance',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'd2',
    dimension: 'focus',
    value: 0.45,
    label: 'Context Switching',
    timestamp: new Date().toISOString(),
  }
];

export const DriftVisualizer: React.FC = () => {
  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4 mb-6">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
        Behavioral Drift Analysis
      </h3>
      
      <div className="space-y-4">
        {MOCK_DRIFT.map(metric => (
          <div key={metric.id}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-300">{metric.label}</span>
              <span className={`font-mono ${
                metric.value > 0.4 ? 'text-orange-400' : 'text-zinc-500'
              }`}>
                {(metric.value * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                   metric.value > 0.6 ? 'bg-red-500' : 
                   metric.value > 0.3 ? 'bg-orange-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${metric.value * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-[10px] text-zinc-600 text-center border-t border-zinc-800/50 pt-2">
        Exploratory visualization — not a judgment.
      </div>
    </div>
  );
};
