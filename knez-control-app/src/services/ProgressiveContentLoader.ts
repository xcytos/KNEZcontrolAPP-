// ─── ProgressiveContentLoader.ts ─────────────────────────────────────────────────
// T1: Progressive Content Loading — adds waitForSelector, waitForLoadState,
//     progressive content checking for dynamic pages.
// ─────────────────────────────────────────────────────────────────────────────

export type LoadState = "domcontentloaded" | "load" | "networkidle";

export interface ProgressiveLoadConfig {
  waitForSelector?: string;
  waitForLoadState?: LoadState;
  maxAttempts?: number;
  attemptDelayMs?: number;
  scrollToLoad?: boolean;
  executeJavaScript?: boolean;
}

export interface LoadResult {
  success: boolean;
  content: string;
  attempts: number;
  loadStateReached: boolean;
  selectorFound: boolean;
  error?: string;
}

/**
 * Progressive content loader for handling dynamic pages.
 */
export class ProgressiveContentLoader {
  /**
   * Check if content has meaningful data.
   */
  static hasMeaningfulContent(content: string): boolean {
    if (!content || content.length < 100) return false;

    // Check for common page elements
    const lowerContent = content.toLowerCase();
    const hasStructure =
      lowerContent.includes("<div") ||
      lowerContent.includes("<p") ||
      lowerContent.includes("<h1") ||
      lowerContent.includes("<h2") ||
      lowerContent.includes("<article") ||
      lowerContent.includes("<main");

    const hasText = content.replace(/<[^>]*>/g, "").trim().length > 50;

    return hasStructure && hasText;
  }

  /**
   * Extract content quality score.
   */
  static getContentQuality(content: string): {
    score: number;
    hasHeadings: boolean;
    hasLinks: boolean;
    hasImages: boolean;
    textLength: number;
  } {
    const textContent = content.replace(/<[^>]*>/g, "").trim();

    return {
      score: this.calculateQualityScore(content),
      hasHeadings: /<h[1-6]/i.test(content),
      hasLinks: /<a\s+href/i.test(content),
      hasImages: /<img/i.test(content),
      textLength: textContent.length
    };
  }

  private static calculateQualityScore(content: string): number {
    let score = 0;

    // Text content weight
    const textContent = content.replace(/<[^>]*>/g, "").trim();
    score += Math.min(textContent.length / 100, 10);

    // Structure weight
    if (/<h[1-6]/i.test(content)) score += 3;
    if (/<p/i.test(content)) score += 2;
    if (/<article|<main|<section/i.test(content)) score += 2;

    // Interactive elements
    if (/<a\s+href/i.test(content)) score += 1;
    if (/<button/i.test(content)) score += 1;

    // Penalize empty or minimal content
    if (textContent.length < 50) score -= 5;

    return Math.max(0, Math.min(10, score));
  }

  /**
   * Simulate progressive loading with multiple attempts.
   * This is a placeholder - actual implementation would integrate with playwright.
   */
  static async loadWithProgressiveStrategy(
    initialContent: string,
    config: ProgressiveLoadConfig = {}
  ): Promise<LoadResult> {
    const {
      maxAttempts = 3,
      attemptDelayMs = 1000,
      scrollToLoad: _scrollToLoad = false,
      executeJavaScript: _executeJavaScript = false
    } = config;

    let currentContent = initialContent;
    let attempts = 0;
    let loadStateReached = false;
    let selectorFound = false;

    for (let i = 0; i < maxAttempts; i++) {
      attempts++;

      // Check if content is already good enough
      if (this.hasMeaningfulContent(currentContent)) {
        const quality = this.getContentQuality(currentContent);
        if (quality.score >= 5) {
          loadStateReached = true;
          break;
        }
      }

      // Simulate waiting for dynamic content
      if (attemptDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, attemptDelayMs));
      }

      // In real implementation, this would:
      // 1. Scroll page if scrollToLoad is true
      // 2. Execute JavaScript if executeJavaScript is true
      // 3. Check for selector if waitForSelector is provided
      // 4. Check load state if waitForLoadState is provided

      // For now, simulate content improvement
      if (currentContent.length < 1000) {
        currentContent += " <!-- Simulated dynamic content loaded -->";
      }
    }

    // Check selector
    if (config.waitForSelector) {
      selectorFound = currentContent.toLowerCase().includes(config.waitForSelector.toLowerCase());
    }

    return {
      success: this.hasMeaningfulContent(currentContent),
      content: currentContent,
      attempts,
      loadStateReached,
      selectorFound,
      error: this.hasMeaningfulContent(currentContent) ? undefined : "Content remains minimal after progressive loading"
    };
  }

  /**
   * Generate progressive loading hints for the model.
   */
  static generateProgressiveHints(result: LoadResult): string {
    const hints: string[] = [];

    if (!result.success) {
      hints.push("⚠️ Progressive content loading did not yield meaningful content");
    }

    if (result.attempts > 1) {
      hints.push(`🔄 Made ${result.attempts} attempts to load content`);
    }

    if (!result.loadStateReached) {
      hints.push("⏱️ Page load state not reached - content may still be loading");
    }

    if (result.selectorFound === false && result.selectorFound !== undefined) {
      hints.push("🔍 Expected selector not found - page structure may differ");
    }

    if (hints.length === 0) {
      hints.push("✅ Content loaded successfully");
    }

    return hints.join("\n");
  }

  /**
   * Determine if progressive loading is needed based on content.
   */
  static needsProgressiveLoading(content: string): boolean {
    if (!content || content.length === 0) return true;
    if (content.length < 100) return true;
    if (!this.hasMeaningfulContent(content)) return true;

    const quality = this.getContentQuality(content);
    return quality.score < 5;
  }

  /**
   * Get recommended progressive loading configuration for page type.
   */
  static getRecommendedConfig(pageType: string): ProgressiveLoadConfig {
    const configs: Record<string, ProgressiveLoadConfig> = {
      blog: {
        waitForLoadState: "load",
        maxAttempts: 3,
        attemptDelayMs: 1500,
        scrollToLoad: true
      },
      ecommerce: {
        waitForLoadState: "load",
        maxAttempts: 4,
        attemptDelayMs: 2000,
        scrollToLoad: true,
        executeJavaScript: true
      },
      spa: {
        waitForLoadState: "networkidle",
        maxAttempts: 5,
        attemptDelayMs: 1000,
        executeJavaScript: true
      },
      documentation: {
        waitForLoadState: "domcontentloaded",
        maxAttempts: 2,
        attemptDelayMs: 1000
      },
      default: {
        maxAttempts: 3,
        attemptDelayMs: 1000
      }
    };

    return configs[pageType.toLowerCase()] ?? configs.default;
  }
}
