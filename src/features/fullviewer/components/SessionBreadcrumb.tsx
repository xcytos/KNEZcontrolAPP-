import React from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface SessionBreadcrumbProps {
  items: BreadcrumbItem[];
}

export const SessionBreadcrumb: React.FC<SessionBreadcrumbProps> = ({ items }) => {
  return (
    <div className="flex items-center gap-1 text-xs text-zinc-500">
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight className="w-3 h-3" />}
          {item.onClick ? (
            <button onClick={item.onClick} className="hover:text-zinc-300 transition-colors">
              {item.label}
            </button>
          ) : (
            <span>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
