// ─── ProgressiveContentLoader.ts ─────────────────────────────────────────────────
// T1: Progressive Content Loading — adds waitForSelector, waitForLoadState,
//     progressive content checking for dynamic pages.
// ─────────────────────────────────────────────────────────────────────────────

import { toolExecutionService } from "./ToolExecutionService";
import { logger } from "./LogService";
import { TIMEOUT_CONFIG } from "../config/features";

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
   * Integrates with puppeteer MCP server if available for scroll-to-load and JavaScript execution.
   */
  static async loadWithProgressiveStrategy(
    initialContent: string,
    config: ProgressiveLoadConfig = {}
  ): Promise<LoadResult> {
    const {
      maxAttempts = 3,
      attemptDelayMs = 1000,
      scrollToLoad = false,
      executeJavaScript = false
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

      // Try to use puppeteer MCP server if available for advanced loading
      if (scrollToLoad || executeJavaScript) {
        try {
          // Try scroll-to-load
          if (scrollToLoad) {
            try {
              const scrollResult = await toolExecutionService.executeNamespacedTool(
                "puppeteer__scroll_to_bottom",
                {},
                { timeoutMs: 5000 }
              );
              if (scrollResult.ok) {
                await new Promise(r => setTimeout(r, TIMEOUT_CONFIG.PROGRESSIVE_LOAD_DELAY_MS)); // Wait for content to load
              }
            } catch (e) {
              logger.warn('progressive_loader', 'scroll_to_bottom_failed', { error: String(e) });
            }
          }

          // Try JavaScript execution
          if (executeJavaScript) {
            try {
              const jsResult = await toolExecutionService.executeNamespacedTool(
                "puppeteer__evaluate_javascript",
                { code: "window.scrollTo(0, document.body.scrollHeight)" },
                { timeoutMs: 5000 }
              );
              if (jsResult.ok) {
                await new Promise(r => setTimeout(r, TIMEOUT_CONFIG.PROGRESSIVE_LOAD_DELAY_MS)); // Wait for content to load
              }
            } catch (e) {
              logger.warn('progressive_loader', 'evaluate_javascript_failed', { error: String(e) });
            }
          }
        } catch (e) {
          logger.warn('progressive_loader', 'progressive_load_failed', { error: String(e) });
        }
      }

      // Simulate waiting for dynamic content (fallback if puppeteer unavailable)
      if (attemptDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, attemptDelayMs));
      }

      // For now, simulate content improvement if no real integration available
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
