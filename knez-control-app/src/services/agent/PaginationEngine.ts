/**
 * PaginationEngine - Auto-detects and iterates through paginated content
 * Accumulates results across multiple pages
 */

export interface PaginationDetection {
  hasPagination: boolean;
  paginationType: "next_button" | "load_more" | "infinite_scroll" | "page_numbers";
  selector?: string;
  totalPages?: number;
}

export interface PaginationResult<T> {
  items: T[];
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
}

export interface PaginationConfig {
  maxPages: number;
  maxItems: number;
  delayBetweenPages: number;
}

export class PaginationEngine {
  private config: PaginationConfig = {
    maxPages: 10,
    maxItems: 1000,
    delayBetweenPages: 1000
  };

  constructor(config?: Partial<PaginationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Detect pagination in page content
   */
  detectPagination(pageContent: any): PaginationDetection {
    // Check for common pagination indicators
    const hasNextButton = this.checkForNextButton(pageContent);
    const hasLoadMore = this.checkForLoadMore(pageContent);
    const hasPageNumbers = this.checkForPageNumbers(pageContent);
    const hasInfiniteScroll = this.checkForInfiniteScroll(pageContent);

    if (hasNextButton) {
      return {
        hasPagination: true,
        paginationType: "next_button",
        selector: this.findNextButtonSelector(pageContent)
      };
    }

    if (hasLoadMore) {
      return {
        hasPagination: true,
        paginationType: "load_more",
        selector: this.findLoadMoreSelector(pageContent)
      };
    }

    if (hasPageNumbers) {
      return {
        hasPagination: true,
        paginationType: "page_numbers",
        selector: this.findPageNumbersSelector(pageContent),
        totalPages: this.estimateTotalPages(pageContent)
      };
    }

    if (hasInfiniteScroll) {
      return {
        hasPagination: true,
        paginationType: "infinite_scroll"
      };
    }

    return {
      hasPagination: false,
      paginationType: "next_button"
    };
  }

  /**
   * Check for next button presence
   */
  private checkForNextButton(pageContent: any): boolean {
    if (!pageContent || !pageContent.elements) return false;

    const nextButtonKeywords = ["next", ">", "→", "forward"];
    const elements = pageContent.elements || [];

    return elements.some((el: any) => {
      const text = (el.text || el.role || "").toLowerCase();
      return nextButtonKeywords.some(keyword => text.includes(keyword));
    });
  }

  /**
   * Check for load more button presence
   */
  private checkForLoadMore(pageContent: any): boolean {
    if (!pageContent || !pageContent.elements) return false;

    const loadMoreKeywords = ["load more", "show more", "view more"];
    const elements = pageContent.elements || [];

    return elements.some((el: any) => {
      const text = (el.text || el.role || "").toLowerCase();
      return loadMoreKeywords.some(keyword => text.includes(keyword));
    });
  }

  /**
   * Check for page numbers presence
   */
  private checkForPageNumbers(pageContent: any): boolean {
    if (!pageContent || !pageContent.elements) return false;

    const elements = pageContent.elements || [];
    const numberPattern = /^\d+$/;

    // Look for consecutive numbers which likely indicate page numbers
    const numbers = elements
      .map((el: any) => el.text)
      .filter((text: string) => numberPattern.test(text))
      .map((text: string) => parseInt(text, 10));

    // Check if we have at least 3 consecutive numbers
    let consecutive = 0;
    for (let i = 0; i < numbers.length - 1; i++) {
      if (numbers[i + 1] === numbers[i] + 1) {
        consecutive++;
        if (consecutive >= 2) return true;
      } else {
        consecutive = 0;
      }
    }

    return false;
  }

  /**
   * Check for infinite scroll indicators
   */
  private checkForInfiniteScroll(pageContent: any): boolean {
    if (!pageContent || !pageContent.elements) return false;

    const scrollKeywords = ["scroll", "loading", "spinner"];
    const elements = pageContent.elements || [];

    return elements.some((el: any) => {
      const text = (el.text || el.role || el.className || "").toLowerCase();
      return scrollKeywords.some(keyword => text.includes(keyword));
    });
  }

  /**
   * Find selector for next button
   */
  private findNextButtonSelector(pageContent: any): string | undefined {
    if (!pageContent || !pageContent.elements) return undefined;

    const nextButtonKeywords = ["next", ">", "→", "forward"];
    const elements = pageContent.elements || [];

    const nextButton = elements.find((el: any) => {
      const text = (el.text || el.role || "").toLowerCase();
      return nextButtonKeywords.some(keyword => text.includes(keyword));
    });

    return nextButton?.ref || nextButton?.selector;
  }

  /**
   * Find selector for load more button
   */
  private findLoadMoreSelector(pageContent: any): string | undefined {
    if (!pageContent || !pageContent.elements) return undefined;

    const loadMoreKeywords = ["load more", "show more", "view more"];
    const elements = pageContent.elements || [];

    const loadMoreButton = elements.find((el: any) => {
      const text = (el.text || el.role || "").toLowerCase();
      return loadMoreKeywords.some(keyword => text.includes(keyword));
    });

    return loadMoreButton?.ref || loadMoreButton?.selector;
  }

  /**
   * Find selector for page numbers
   */
  private findPageNumbersSelector(pageContent: any): string | undefined {
    if (!pageContent || !pageContent.elements) return undefined;

    const elements = pageContent.elements || [];
    const numberPattern = /^\d+$/;

    const pageNumber = elements.find((el: any) => numberPattern.test(el.text));

    return pageNumber?.ref || pageNumber?.selector;
  }

  /**
   * Estimate total pages from page numbers
   */
  private estimateTotalPages(pageContent: any): number {
    if (!pageContent || !pageContent.elements) return 1;

    const elements = pageContent.elements || [];
    const numberPattern = /^\d+$/;

    const numbers = elements
      .map((el: any) => el.text)
      .filter((text: string) => numberPattern.test(text))
      .map((text: string) => parseInt(text, 10));

    if (numbers.length === 0) return 1;

    return Math.max(...numbers);
  }

  /**
   * Extract items from page content
   */
  extractItems<T>(pageContent: any, itemSelector: string): T[] {
    if (!pageContent || !pageContent.elements) return [];

    const elements = pageContent.elements || [];
    
    // Filter elements that match the item selector
    const items = elements.filter((el: any) => {
      return el.className?.includes(itemSelector) || 
             el.role?.includes(itemSelector) ||
             el.ref?.includes(itemSelector);
    });

    return items as T[];
  }

  /**
   * Accumulate results across pages
   */
  accumulateResults<T>(results: T[][]): T[] {
    return results.flat();
  }

  /**
   * Check if should continue pagination
   */
  shouldContinue(currentPage: number, totalItems: number): boolean {
    return currentPage < this.config.maxPages && totalItems < this.config.maxItems;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PaginationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): PaginationConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const paginationEngine = new PaginationEngine();
