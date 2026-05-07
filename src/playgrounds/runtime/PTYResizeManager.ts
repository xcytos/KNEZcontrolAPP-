export interface PTYResizeEvent {
  ptyId: string;
  oldCols: number;
  oldRows: number;
  newCols: number;
  newRows: number;
  timestamp: Date;
  source: 'user_resize' | 'terminal_resize' | 'font_change' | 'window_resize';
}

export interface PTYResizeConfig {
  debounceMs: number;
  minCols: number;
  minRows: number;
  maxCols: number;
  maxRows: number;
  enableAutoFit: boolean;
  respectAspectRatio: boolean;
}

export class PTYResizeManager {
  private resizeObservers: Map<string, { observer: ResizeObserver; element: HTMLElement }> = new Map();
  private resizeHistory: Map<string, PTYResizeEvent[]> = new Map();
  private config: PTYResizeConfig;
  private resizeTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<PTYResizeConfig> = {}) {
    this.config = {
      debounceMs: 100,
      minCols: 40,
      minRows: 10,
      maxCols: 300,
      maxRows: 100,
      enableAutoFit: true,
      respectAspectRatio: false,
      ...config
    };
  }

  // Public API
  observePTY(ptyId: string, element: HTMLElement): void {
    if (this.resizeObservers.has(ptyId)) {
      this.unobservePTY(ptyId);
    }

    const resizeObserver = new ResizeObserver(entries => {
      this.handleResize(ptyId, entries);
    });

    resizeObserver.observe(element);
    this.resizeObservers.set(ptyId, { observer: resizeObserver, element });
  }

  unobservePTY(ptyId: string): void {
    const observerData = this.resizeObservers.get(ptyId);
    if (observerData) {
      observerData.observer.disconnect();
      this.resizeObservers.delete(ptyId);
    }
  }

  resizePTY(ptyId: string, cols: number, rows: number, source: PTYResizeEvent['source'] = 'terminal_resize'): void {
    const lastEvent = this.getLastResizeEvent(ptyId);
    const newEvent: PTYResizeEvent = {
      ptyId,
      oldCols: lastEvent?.newCols || 80,
      oldRows: lastEvent?.newRows || 24,
      newCols: cols,
      newRows: rows,
      timestamp: new Date(),
      source
    };

    this.addResizeEvent(ptyId, newEvent);
    this.emitEvent('resize', newEvent);
  }

  autoFitPTY(ptyId: string): void {
    const observer = this.resizeObservers.get(ptyId);
    if (!observer) {
      console.warn(`[PTYResizeManager] No resize observer for PTY ${ptyId}`);
      return;
    }

    // Get observed element
    const element = observer.element;
    if (!element) return;
    
    // Calculate optimal size
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    // Get character dimensions from computed style
    const charWidth = this.getCharacterWidth(computedStyle);
    const charHeight = this.getCharacterHeight(computedStyle);
    
    // Calculate optimal cols/rows
    const containerWidth = rect.width - (parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight));
    const containerHeight = rect.height - (parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom));
    
    const optimalCols = Math.floor(containerWidth / charWidth);
    const optimalRows = Math.floor(containerHeight / charHeight);
    
    // Apply constraints
    const finalCols = Math.max(this.config.minCols, Math.min(this.config.maxCols, optimalCols));
    const finalRows = Math.max(this.config.minRows, Math.min(this.config.maxRows, optimalRows));
    
    this.resizePTY(ptyId, finalCols, finalRows, 'terminal_resize');
  }

  getPTYSize(ptyId: string): { cols: number; rows: number } | null {
    const lastEvent = this.getLastResizeEvent(ptyId);
    if (!lastEvent) return null;
    
    return {
      cols: lastEvent.newCols,
      rows: lastEvent.newRows
    };
  }

  getResizeHistory(ptyId: string): PTYResizeEvent[] {
    return this.resizeHistory.get(ptyId) || [];
  }

  getLastResizeEvent(ptyId: string): PTYResizeEvent | undefined {
    const history = this.resizeHistory.get(ptyId);
    return history ? history[history.length - 1] : undefined;
  }

  // Private methods
  private handleResize(ptyId: string, entries: ResizeObserverEntry[]): void {
    if (!this.config.enableAutoFit) return;

    // Debounce rapid resize events
    const timer = this.resizeTimers.get(ptyId);
    if (timer) {
      clearTimeout(timer);
    }

    const debouncedTimer = setTimeout(() => {
      const entry = entries[entries.length - 1];
      if (!entry) return;

      const { contentRect } = entry;
      const newCols = Math.round(contentRect.width);
      const newRows = Math.round(contentRect.height);

      // Only resize if dimensions actually changed
      const lastEvent = this.getLastResizeEvent(ptyId);
      if (!lastEvent || lastEvent.newCols !== newCols || lastEvent.newRows !== newRows) {
        this.resizePTY(ptyId, newCols, newRows, 'user_resize');
      }
    }, this.config.debounceMs);

    this.resizeTimers.set(ptyId, debouncedTimer);
  }

  private getCharacterWidth(computedStyle: CSSStyleDeclaration): number {
    // Try to get character width from font metrics
    const fontSize = parseFloat(computedStyle.fontSize);
    // const _fontFamily = computedStyle.fontFamily; // Unused
    
    // Default character width approximation (can be improved with actual font metrics)
    const charWidth = fontSize * 0.6; // Approximate monospace character width
    
    return charWidth;
  }

  private getCharacterHeight(computedStyle: CSSStyleDeclaration): number {
    const fontSize = parseFloat(computedStyle.fontSize);
    const lineHeight = parseFloat(computedStyle.lineHeight);
    
    // Default character height approximation
    const charHeight = lineHeight || fontSize * 1.2;
    
    return charHeight;
  }

  private addResizeEvent(ptyId: string, event: PTYResizeEvent): void {
    if (!this.resizeHistory.has(ptyId)) {
      this.resizeHistory.set(ptyId, []);
    }
    
    const history = this.resizeHistory.get(ptyId)!;
    history.push(event);
    
    // Keep only last 100 events to prevent memory leaks
    if (history.length > 100) {
      this.resizeHistory.set(ptyId, history.slice(-100));
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in PTYResizeManager event listener for ${event}:`, error);
        }
      });
    }
  }

  // Event handling
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Cleanup
  destroy(): void {
    // Clear all observers
    this.resizeObservers.forEach(observerData => {
      observerData.observer.disconnect();
    });
    this.resizeObservers.clear();

    // Clear all timers
    this.resizeTimers.forEach(timer => clearTimeout(timer));
    this.resizeTimers.clear();

    // Clear history
    this.resizeHistory.clear();

    // Clear event listeners
    this.eventListeners.clear();

    console.log('[PTY Resize Manager] Destroyed');
  }

  // Validation
  validateDimensions(cols: number, rows: number): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (cols < this.config.minCols) {
      issues.push(`Cols ${cols} below minimum ${this.config.minCols}`);
    }

    if (cols > this.config.maxCols) {
      issues.push(`Cols ${cols} above maximum ${this.config.maxCols}`);
    }

    if (rows < this.config.minRows) {
      issues.push(`Rows ${rows} below minimum ${this.config.minRows}`);
    }

    if (rows > this.config.maxRows) {
      issues.push(`Rows ${rows} above maximum ${this.config.maxRows}`);
    }

    if (this.config.respectAspectRatio) {
      const aspectRatio = cols / rows;
      if (aspectRatio < 0.5 || aspectRatio > 3.0) {
        issues.push(`Aspect ratio ${aspectRatio.toFixed(2)} outside acceptable range (0.5-3.0)`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  getStatistics(): {
    totalResizes: number;
    averageResizeTime: number;
    mostCommonSize: { cols: number; rows: number } | null;
  } {
    const allEvents = Array.from(this.resizeHistory.values()).flat();
    const totalResizes = allEvents.length;

    // Calculate average resize time
    let averageResizeTime = 0;
    if (totalResizes > 1) {
      const timeDiffs = allEvents.slice(1).map((event, index) => 
        event.timestamp.getTime() - allEvents[index].timestamp.getTime()
      );
      averageResizeTime = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    }

    // Find most common size
    const sizeFrequency = new Map<string, number>();
    allEvents.forEach(event => {
      const sizeKey = `${event.newCols}x${event.newRows}`;
      sizeFrequency.set(sizeKey, (sizeFrequency.get(sizeKey) || 0) + 1);
    });

    let mostCommonSize = null;
    let maxFrequency = 0;
    sizeFrequency.forEach((frequency, sizeKey) => {
      if (frequency > maxFrequency) {
        maxFrequency = frequency;
        const [cols, rows] = sizeKey.split('x').map(Number);
        mostCommonSize = { cols, rows };
      }
    });

    return {
      totalResizes,
      averageResizeTime,
      mostCommonSize
    };
  }
}

// Singleton instance
let globalPTYResizeManager: PTYResizeManager | null = null;

export function getPTYResizeManager(): PTYResizeManager {
  if (!globalPTYResizeManager) {
    globalPTYResizeManager = new PTYResizeManager();
  }
  return globalPTYResizeManager;
}
