import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';

interface ResizableSplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  className?: string;
}

export const ResizableSplitPane: React.FC<ResizableSplitPaneProps> = ({
  left,
  right,
  defaultLeftWidth = 288,
  minLeftWidth = 160,
  maxLeftWidth = 500,
  className = '',
}) => {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let newWidth = e.clientX - rect.left;
    newWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth));
    setLeftWidth(newWidth);
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className={`flex h-full overflow-hidden ${className}`}>
      <div style={{ width: leftWidth }} className="flex-shrink-0 flex flex-col overflow-hidden">
        {left}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={`w-2 flex-shrink-0 flex items-center justify-center cursor-col-resize transition-colors group relative ${
          isDragging ? 'bg-blue-500/20' : 'hover:bg-blue-500/10'
        }`}
      >
        <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors ${
          isDragging ? 'bg-blue-400' : 'bg-zinc-700 group-hover:bg-zinc-500'
        }`} />
        <GripVertical className={`w-3 h-3 relative z-10 transition-colors ${
          isDragging ? 'text-blue-400' : 'text-zinc-600 group-hover:text-zinc-400'
        }`} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ChevronLeft className="w-3 h-3 text-zinc-500" />
          <ChevronRight className="w-3 h-3 text-zinc-500" />
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {right}
      </div>
    </div>
  );
};