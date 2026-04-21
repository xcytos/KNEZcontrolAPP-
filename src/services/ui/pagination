// ─── SmartPaginationController.ts ─────────────────────────────────────────
// T6: Smart Pagination Controller — detects pagination elements and implements
//     pagination strategies (scroll-based, load-more, virtual scroll).
//     Content detection: identify pagination elements (next button, infinite scroll, load more).
// ─────────────────────────────────────────────────────────────────────────────

export type PaginationStrategy = 'scroll_based' | 'load_more' | 'virtual_scroll' | 'manual';

export interface PaginationElement {
  type: 'next_button' | 'load_more' | 'infinite_scroll' | 'pagination_controls';
  selector: string;
  text?: string;
  visible: boolean;
}

export interface PaginationState {
  currentPage: number;
  totalPages?: number;
  itemsPerPage?: number;
  totalItems?: number;
  hasMore: boolean;
  strategy: PaginationStrategy;
  detectedElements: PaginationElement[];
}

export interface PaginationProgress {
  loadedPages: number;
  loadedItems: number;
  progressPercentage: number;
  estimatedRemaining: number;
}

/**
 * Smart pagination controller with automatic detection and execution.
 */
export class SmartPaginationController {
  private paginationStates: Map<string, PaginationState> = new Map(); // sessionId -> state

  /**
   * Detect pagination elements in page content.
   */
  detectPagination(content: string, _snapshot?: any): PaginationElement[] {
    const elements: PaginationElement[] = [];

    // Detect next button patterns
    const nextButtonPatterns = [
      /next/i,
      /→/,
      /»/,
      /more/i,
      /load more/i
    ];

    // Detect load more button
    if (content.toLowerCase().includes('load more') || 
        content.toLowerCase().includes('show more')) {
      elements.push({
        type: 'load_more',
        selector: 'button:has-text("Load More"), button:has-text("Show More")',
        visible: true
      });
    }

    // Detect pagination controls (1, 2, 3...)
    if (/\b\d+\s*[,-]\s*\d+\b/.test(content) || 
        /page\s*\d+/.test(content.toLowerCase())) {
      elements.push({
        type: 'pagination_controls',
        selector: '[class*="pagination"], [class*="page"]',
        visible: true
      });
    }

    // Detect infinite scroll indicators
    if (content.toLowerCase().includes('infinite scroll') ||
        content.toLowerCase().includes('scroll to load')) {
      elements.push({
        type: 'infinite_scroll',
        selector: 'body',
        visible: true
      });
    }

    // Detect next button
    for (const pattern of nextButtonPatterns) {
      if (pattern.test(content)) {
        elements.push({
          type: 'next_button',
          selector: 'button:has-text("Next"), a:has-text("Next"), [aria-label*="next"]',
          visible: true
        });
        break;
      }
    }

    return elements;
  }

  /**
   * Determine pagination strategy based on detected elements.
   */
  determineStrategy(elements: PaginationElement[]): PaginationStrategy {
    if (elements.some(e => e.type === 'infinite_scroll')) {
      return 'scroll_based';
    }
    if (elements.some(e => e.type === 'load_more')) {
      return 'load_more';
    }
    if (elements.some(e => e.type === 'pagination_controls')) {
      return 'virtual_scroll';
    }
    return 'manual';
  }

  /**
   * Initialize pagination state for a session.
   */
  initializePagination(
    sessionId: string,
    content: string,
    snapshot?: any
  ): PaginationState {
    const elements = this.detectPagination(content, snapshot);
    const strategy = this.determineStrategy(elements);

    const state: PaginationState = {
      currentPage: 1,
      hasMore: true,
      strategy,
      detectedElements: elements
    };

    this.paginationStates.set(sessionId, state);
    return state;
  }

  /**
   * Execute pagination with detected strategy.
   */
  async executePagination(
    sessionId: string,
    page: number,
    executeTool: (tool: string, args: any) => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const state = this.paginationStates.get(sessionId);
    if (!state) {
      return { success: false, error: 'Pagination not initialized' };
    }

    if (!state.hasMore) {
      return { success: false, error: 'No more pages available' };
    }

    try {
      switch (state.strategy) {
        case 'scroll_based':
          return await this.executeScrollPagination(page, executeTool);
        case 'load_more':
          return await this.executeLoadMorePagination(page, state, executeTool);
        case 'virtual_scroll':
          return await this.executeVirtualScrollPagination(page, state, executeTool);
        case 'manual':
          return await this.executeManualPagination(page, state, executeTool);
        default:
          return { success: false, error: 'Unknown pagination strategy' };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute scroll-based pagination.
   */
  private async executeScrollPagination(
    _page: number,
    executeTool: (tool: string, args: any) => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const result = await executeTool('puppeteer_evaluate', {
        func: `
          () => {
            window.scrollTo(0, document.body.scrollHeight);
            return { scrolled: true, scrollHeight: document.body.scrollHeight };
          }
        `
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute load-more button pagination.
   */
  private async executeLoadMorePagination(
    _page: number,
    state: PaginationState,
    executeTool: (tool: string, args: any) => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const loadMoreElement = state.detectedElements.find(e => e.type === 'load_more');
    if (!loadMoreElement) {
      return { success: false, error: 'Load more button not found' };
    }

    try {
      const result = await executeTool('puppeteer_click', {
        selector: loadMoreElement.selector
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1500));

      return { success: true, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute virtual scroll pagination.
   */
  private async executeVirtualScrollPagination(
    _page: number,
    _state: PaginationState,
    executeTool: (tool: string, args: any) => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Click on specific page number
      const result = await executeTool('puppeteer_click', {
        selector: `[class*="page"] a:has-text("${_page}")`
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute manual pagination (next button).
   */
  private async executeManualPagination(
    _page: number,
    state: PaginationState,
    executeTool: (tool: string, args: any) => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const nextButton = state.detectedElements.find(e => e.type === 'next_button');
    if (!nextButton) {
      return { success: false, error: 'Next button not found' };
    }

    try {
      const result = await executeTool('puppeteer_click', {
        selector: nextButton.selector
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get pagination progress.
   */
  getPaginationProgress(sessionId: string): PaginationProgress | null {
    const state = this.paginationStates.get(sessionId);
    if (!state) return null;

    const loadedPages = state.currentPage;
    const loadedItems = loadedPages * (state.itemsPerPage || 10);
    const totalItems = state.totalItems || (loadedItems * 2); // Estimate if unknown
    const progressPercentage = totalItems > 0 ? (loadedItems / totalItems) * 100 : 0;
    const estimatedRemaining = totalItems - loadedItems;

    return {
      loadedPages,
      loadedItems,
      progressPercentage: Math.min(100, progressPercentage),
      estimatedRemaining: Math.max(0, estimatedRemaining)
    };
  }

  /**
   * Update pagination state after successful pagination.
   */
  updatePaginationState(
    sessionId: string,
    success: boolean,
    hasMore: boolean
  ): void {
    const state = this.paginationStates.get(sessionId);
    if (!state) return;

    if (success) {
      state.currentPage++;
    }
    state.hasMore = hasMore;
    this.paginationStates.set(sessionId, state);
  }

  /**
   * Check if more pages are available.
   */
  hasMorePages(sessionId: string): boolean {
    const state = this.paginationStates.get(sessionId);
    return state ? state.hasMore : false;
  }

  /**
   * Get current pagination state.
   */
  getPaginationState(sessionId: string): PaginationState | null {
    return this.paginationStates.get(sessionId) || null;
  }

  /**
   * Clear pagination state for a session.
   */
  clearPagination(sessionId: string): void {
    this.paginationStates.delete(sessionId);
  }

  /**
   * Clear all pagination states.
   */
  clearAllPagination(): void {
    this.paginationStates.clear();
  }

  /**
   * Get active pagination sessions.
   */
  getActiveSessions(): string[] {
    return Array.from(this.paginationStates.keys());
  }
}

// Global instance
export const smartPaginationController = new SmartPaginationController();
