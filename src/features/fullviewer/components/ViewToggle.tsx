import React from 'react';

interface ViewToggleProps {
  options: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ options, active, onChange }) => {
  return (
    <div className="flex bg-zinc-800 rounded-lg p-0.5 gap-0.5">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            active === opt.id
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
