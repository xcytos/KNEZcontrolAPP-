// ─── FallbackStrategy.ts ─────────────────────────────────────────────────
// T7: Fallback Strategy Framework — defines fallback chains, alternative tools,
//     content extraction fallbacks for better error recovery.
// TICKET-003: Web Automation Adaptive Strategies — selector variants, dynamic content, alternative paths
// ─────────────────────────────────────────────────────────────────────────────

import { deduplicateAndExclude } from "../../utils/arrayUtils";
import { SLICE_LIMITS } from "../../config/features";

/**
 * Generate selector variants for click fallbacks
 * - By text: [role="button"], text content
 * - By role: [role="link"], [role="button"]
 * - By test-id: [data-testid], [data-test], [data-cy]
 */
export function generateSelectorVariants(selector: string): string[] {
  const variants: string[] = [];
  
  // If selector looks like CSS class or ID, try text-based variants
  if (selector.startsWith('.') || selector.startsWith('#') || selector.includes('[')) {
    // Try by role (button, link)
    variants.push('[role="button"]', '[role="link"]');
    
    // Try by test-id attributes
    variants.push('[data-testid]', '[data-test]', '[data-cy]', '[data-qa]');
  }
  
  // If selector contains text, try exact text match
  if (selector.length > 0 && !selector.startsWith('[') && !selector.startsWith('.')) {
    variants.push(`text="${selector}"`);
    variants.push(`[text="${selector}"]`);
  }
  
  // Deduplicate and limit
  return deduplicateAndExclude(variants, selector, 5);
}

/**
 * Dynamic content handling strategies for navigation failures
 * - Scroll to bottom
 * - Wait for dynamic content
 * - Try pagination
 */
export interface DynamicContentStrategy {
  action: "scroll" | "wait" | "paginate";
  description: string;
  params?: any;
}

export function getDynamicContentStrategies(error: string): DynamicContentStrategy[] {
  const strategies: DynamicContentStrategy[] = [];
  
  if (error.includes("minimal_content") || error.includes("no content")) {
    strategies.push({
      action: "scroll",
      description: "Scroll to bottom to trigger lazy loading",
      params: { target: "bottom" }
    });
    strategies.push({
      action: "wait",
      description: "Wait for dynamic content to load",
      params: { duration: 2000 }
    });
  }
  
  if (error.includes("pagination") || error.includes("more content")) {
    strategies.push({
      action: "paginate",
      description: "Try pagination to load more content",
      params: { method: "next" }
    });
  }
  
  return strategies.slice(0, 3);
}

/**
 * Alternative path strategies for navigation failures
 * - Try /blog, /docs, /wiki variants
 * - Try parent paths
 * - Try with/without trailing slash
 */
export function getPathAlternatives(path: string): string[] {
  const alternatives: string[] = [];
  
  // Common path variants
  const pathVariants: Record<string, string[]> = {
    "": ["/blog", "/docs", "/wiki"],
    "/blog": ["/blogs", "/articles", "/posts", "/docs"],
    "/docs": ["/documentation", "/wiki", "/help"],
    "/wiki": ["/docs", "/help", "/knowledge"]
  };
  
  // Get base path
  const basePath = path.split('/').filter(Boolean).slice(0, -1).join('/') || '';
  
  if (pathVariants[path]) {
    for (const variant of pathVariants[path]) {
      alternatives.push(variant);
    }
  }
  
  // Try parent path
  if (basePath) {
    alternatives.push(`/${basePath}`);
  }
  
  // Try with/without trailing slash
  if (!path.endsWith('/')) {
    alternatives.push(`${path}/`);
  } else {
    alternatives.push(path.replace(/\/$/, ''));
  }
  
  return deduplicateAndExclude(alternatives, path, 5);
}

export interface FallbackChain {
  primaryTool: string;
  fallbacks: Array<{
    tool: string;
    argumentModifier?: (args: any) => any;
    condition: (error: string) => boolean;
  }>;
}

export interface ContentExtractionFallback {
  primaryMethod: string;
  fallbacks: Array<{
    method: string;
    condition: (content: any) => boolean;
    transformer?: (content: any) => any;
  }>;
}

/**
 * Predefined fallback chains for common tools.
 */
const FALLBACK_CHAINS: Record<string, FallbackChain> = {
  // Browser navigation fallbacks with dynamic content and path alternatives
  playwright__browser_navigate: {
    primaryTool: "playwright__browser_navigate",
    fallbacks: [
      {
        tool: "playwright__browser_navigate",
        argumentModifier: (args) => {
          const alternatives = getPathAlternatives(new URL(args.url).pathname);
          const altPath = alternatives[0];
          if (altPath) {
            const parsed = new URL(args.url);
            parsed.pathname = altPath;
            return { ...args, url: parsed.toString() };
          }
          return { ...args, timeout: 60000 };
        },
        condition: (error) => error.includes("404") || error.includes("not found")
      },
      {
        tool: "fetch__fetch",
        argumentModifier: (args) => ({ url: args.url }),
        condition: (error) => error.includes("timeout") || error.includes("minimal_content")
      },
      {
        tool: "playwright__browser_navigate",
        argumentModifier: (_args) => ({ timeout: 60000 }),
        condition: (error) => error.includes("timeout")
      }
    ]
  },

  // Browser click fallbacks with adaptive selector variants
  playwright__browser_click: {
    primaryTool: "playwright__browser_click",
    fallbacks: [
      {
        tool: "playwright__browser_click",
        argumentModifier: (args) => {
          const variants = generateSelectorVariants(args.selector);
          return { ...args, selector: variants[0] || args.selector };
        },
        condition: (error) => error.includes("element not found") || error.includes("selector")
      },
      {
        tool: "playwright__browser_navigate",
        argumentModifier: (args) => ({ url: args.url }),
        condition: (error) => error.includes("element not found") || error.includes("selector")
      },
      {
        tool: "playwright__browser_snapshot",
        argumentModifier: (_args) => ({}),
        condition: (error) => error.includes("timeout")
      }
    ]
  },

  // Snapshot fallbacks
  playwright__browser_snapshot: {
    primaryTool: "playwright__browser_snapshot",
    fallbacks: [
      {
        tool: "fetch__fetch",
        argumentModifier: (args) => ({ url: args.url }),
        condition: (error) => error.includes("timeout") || error.includes("minimal_content")
      }
    ]
  },

  // Fetch fallbacks
  fetch__fetch: {
    primaryTool: "fetch__fetch",
    fallbacks: [
      {
        tool: "playwright__browser_navigate",
        argumentModifier: (args) => ({ url: args.url }),
        condition: (error) => error.includes("CORS") || error.includes("403")
      }
    ]
  }
};

/**
 * Content extraction fallback strategies.
 */
const CONTENT_EXTRACTION_FALLBACKS: Record<string, ContentExtractionFallback> = {
  html: {
    primaryMethod: "html_parse",
    fallbacks: [
      {
        method: "regex_extract",
        condition: (content) => !content || typeof content !== "string"
      },
      {
        method: "raw_text",
        condition: (content) => content && content.length < 100
      }
    ]
  },
  json: {
    primaryMethod: "json_parse",
    fallbacks: [
      {
        method: "json_repair",
        transformer: (content) => JSON.stringify(content),
        condition: (content) => typeof content === "object"
      },
      {
        method: "raw_text",
        condition: (content) => !content
      }
    ]
  }
};

/**
 * Get fallback chain for a tool.
 */
export function getFallbackChain(toolName: string): FallbackChain | null {
  return FALLBACK_CHAINS[toolName] ?? null;
}

/**
 * Get next fallback tool based on error and attempt count.
 */
export function getNextFallback(
  toolName: string,
  error: string,
  attemptCount: number
): { tool: string; modifiedArgs?: any } | null {
  const chain = getFallbackChain(toolName);
  if (!chain) return null;

  if (attemptCount >= chain.fallbacks.length) {
    return null;
  }

  const fallback = chain.fallbacks[attemptCount];
  if (!fallback.condition(error)) {
    return getNextFallback(toolName, error, attemptCount + 1);
  }

  return {
    tool: fallback.tool,
    modifiedArgs: fallback.argumentModifier ? fallback.argumentModifier({}) : undefined
  };
}

/**
 * Get content extraction fallback.
 */
export function getContentExtractionFallback(
  method: string,
  content: any
): { method: string; transformer?: (content: any) => any } | null {
  const fallback = CONTENT_EXTRACTION_FALLBACKS[method];
  if (!fallback) return null;

  for (const fb of fallback.fallbacks) {
    if (fb.condition(content)) {
      return { method: fb.method, transformer: fb.transformer };
    }
  }

  return null;
}

/**
 * Navigation URL alternatives (from ToolResultValidator).
 */
export function getNavigationAlternatives(url: string, _error: string): string[] {
  const alternatives: string[] = [];

  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    const pathname = parsed.pathname.replace(/\/$/, "");

    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? "";

    // Blog/article path mutations
    const blogAlts: Record<string, string[]> = {
      blog: ["blogs", "articles", "posts", "news"],
      blogs: ["blog", "articles", "posts"],
      article: ["articles", "blog", "posts"],
      articles: ["article", "blog", "posts"],
      post: ["posts", "blog", "articles"],
      posts: ["post", "blog", "articles"],
      news: ["blog", "articles"]
    };

    if (blogAlts[lastSegment]) {
      for (const alt of blogAlts[lastSegment].slice(0, 3)) {
        const altPath = "/" + [...segments.slice(0, -1), alt].join("/");
        alternatives.push(origin + altPath);
      }
    }

    // Try with trailing slash
    if (!pathname.endsWith("/")) {
      alternatives.push(origin + pathname + "/");
    }

    // Try parent path
    if (segments.length > 1) {
      alternatives.push(origin + "/" + segments.slice(0, -1).join("/"));
    }

    // Try root if deep
    if (segments.length > 2) {
      alternatives.push(origin);
    }
  } catch {
    // Not a valid URL
  }

  // Deduplicate and remove original
  return deduplicateAndExclude(alternatives, url, SLICE_LIMITS.URL_ALTERNATIVES);
}

/**
 * Fallback strategy manager for tracking fallback usage with reasoning.
 */
export class FallbackManager {
  private fallbackUsage: Map<string, { count: number; lastUsed: Date; reasoning: string }> = new Map();

  recordFallback(originalTool: string, fallbackTool: string, reasoning: string): void {
    const key = `${originalTool} -> ${fallbackTool}`;
    const existing = this.fallbackUsage.get(key);

    if (existing) {
      existing.count++;
      existing.lastUsed = new Date();
      existing.reasoning = reasoning;
    } else {
      this.fallbackUsage.set(key, {
        count: 1,
        lastUsed: new Date(),
        reasoning
      });
    }
  }

  getFallbackStats(): Array<{ key: string; count: number; lastUsed: Date; reasoning: string }> {
    return Array.from(this.fallbackUsage.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  getMostUsedFallbacks(limit: number = 5): Array<{ key: string; count: number; lastUsed: Date; reasoning: string }> {
    return this.getFallbackStats().slice(0, limit);
  }

  clear(): void {
    this.fallbackUsage.clear();
  }
}

// Global instance
export const fallbackManager = new FallbackManager();
