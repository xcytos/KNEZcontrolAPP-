// ─── NavigationStateTracker.ts ─────────────────────────────────────────────────
// T12: Navigation State Tracking — adds history stack, backtracking, navigation graph
//     for tracking browser navigation state and enabling back navigation.
// ─────────────────────────────────────────────────────────────────────────────

export interface NavigationState {
  url: string;
  title?: string;
  timestamp: Date;
  toolUsed: string;
  contentPreview?: string;
}

export interface NavigationEdge {
  from: string;
  to: string;
  timestamp: Date;
  toolUsed: string;
}

/**
 * Navigation state tracker for managing browser navigation history.
 */
export class NavigationStateTracker {
  private history: NavigationState[] = [];
  private currentIndex = -1;
  private graph: Map<string, NavigationEdge[]> = new Map();
  private maxHistory = 50;

  /**
   * Add navigation to history.
   */
  addNavigation(state: NavigationState): void {
    // If we're not at the end of history, truncate forward history
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new state
    this.history.push(state);
    this.currentIndex = this.history.length - 1;

    // Add edge to graph if there's a previous state
    if (this.currentIndex > 0) {
      const previous = this.history[this.currentIndex - 1];
      this.addEdge(previous.url, state.url, state.toolUsed);
    }

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * Add edge to navigation graph.
   */
  private addEdge(from: string, to: string, toolUsed: string): void {
    if (!this.graph.has(from)) {
      this.graph.set(from, []);
    }

    this.graph.get(from)!.push({
      from,
      to,
      timestamp: new Date(),
      toolUsed
    });
  }

  /**
   * Get current navigation state.
   */
  getCurrent(): NavigationState | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return this.history[this.currentIndex];
  }

  /**
   * Go back in history.
   */
  goBack(): NavigationState | null {
    if (this.currentIndex <= 0) {
      return null;
    }

    this.currentIndex--;
    return this.history[this.currentIndex];
  }

  /**
   * Go forward in history.
   */
  goForward(): NavigationState | null {
    if (this.currentIndex >= this.history.length - 1) {
      return null;
    }

    this.currentIndex++;
    return this.history[this.currentIndex];
  }

  /**
   * Check if can go back.
   */
  canGoBack(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if can go forward.
   */
  canGoForward(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get navigation history.
   */
  getHistory(): NavigationState[] {
    return [...this.history];
  }

  /**
   * Get navigation graph.
   */
  getGraph(): Map<string, NavigationEdge[]> {
    return new Map(this.graph);
  }

  /**
   * Get possible next URLs from current state.
   */
  getNextUrls(): string[] {
    const current = this.getCurrent();
    if (!current) return [];

    const edges = this.graph.get(current.url) ?? [];
    return edges.map(e => e.to);
  }

  /**
   * Get navigation path to a URL.
   */
  getPathTo(targetUrl: string): NavigationState[] | null {
    const path: NavigationState[] = [];
    const visited = new Set<string>();

    const dfs = (url: string, currentPath: NavigationState[]): boolean => {
      if (url === targetUrl) return true;
      if (visited.has(url)) return false;

      visited.add(url);

      const edges = this.graph.get(url) ?? [];
      for (const edge of edges) {
        const state = this.history.find(h => h.url === edge.to);
        if (state) {
          currentPath.push(state);
          if (dfs(edge.to, currentPath)) return true;
          currentPath.pop();
        }
      }

      return false;
    };

    const current = this.getCurrent();
    if (current) {
      path.push(current);
      if (dfs(current.url, path)) {
        return path;
      }
    }

    return null;
  }

  /**
   * Clear navigation history.
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.graph.clear();
  }

  /**
   * Get navigation statistics.
   */
  getStatistics(): {
    totalNavigations: number;
    uniqueUrls: number;
    mostVisitedUrls: Array<{ url: string; count: number }>;
    commonPaths: Array<{ path: string[]; count: number }>
  } {
    const urlCounts = new Map<string, number>();
    for (const state of this.history) {
      urlCounts.set(state.url, (urlCounts.get(state.url) ?? 0) + 1);
    }

    const mostVisited = Array.from(urlCounts.entries())
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Find common paths (sequences of 2+ URLs)
    const pathCounts = new Map<string, number>();
    for (let i = 0; i < this.history.length - 1; i++) {
      const path = [this.history[i].url, this.history[i + 1].url];
      const pathKey = path.join(" -> ");
      pathCounts.set(pathKey, (pathCounts.get(pathKey) ?? 0) + 1);
    }

    const commonPaths = Array.from(pathCounts.entries())
      .map(([path, count]) => ({ path: path.split(" -> "), count }))
      .filter(p => p.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalNavigations: this.history.length,
      uniqueUrls: urlCounts.size,
      mostVisitedUrls: mostVisited,
      commonPaths
    };
  }
}

// Global instance
export const navigationStateTracker = new NavigationStateTracker();
