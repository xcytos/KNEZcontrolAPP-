// ─── ToolResultValidator.ts ─────────────────────────────────────────────────
// T1: Result-Aware Agent Loop — validates tool results for 404, empty content,
//     and missing data, then generates system hints and corrected retry args.
// T2: Tool Output Interpreter — parses raw MCP output into STRUCTURED_CONTEXT.
// T3: Self-Correcting Navigation — generates URL alternatives on failure.
// ─────────────────────────────────────────────────────────────────────────────

import { deduplicateAndExclude } from "../utils/arrayUtils";
import { SLICE_LIMITS, TIMEOUT_CONFIG } from "../config/features";

export interface ValidatedToolResult {
  isValid: boolean;
  reasons: string[];
  structuredContext: string;
  retryHint: string;
  suggestedRetryArgs?: Record<string, any>;
}

// ─── T2: Structured context parser ──────────────────────────────────────────

function parseStructuredContext(toolName: string, args: any, result: any): string {
  const lines: string[] = ["[STRUCTURED_CONTEXT]"];

  const toolShortName = String(toolName ?? "").split("__").pop() ?? toolName;
  lines.push(`tool: ${toolShortName}`);

  if (args && typeof args === "object") {
    if (args.url) lines.push(`requested_url: ${args.url}`);
    if (args.action) lines.push(`action: ${args.action}`);
    if (args.query) lines.push(`query: ${args.query}`);
  }

  if (!result || typeof result !== "object") {
    lines.push("page_valid: false");
    lines.push("reason: null_or_non_object_result");
    return lines.join("\n");
  }

  // Status / HTTP detection
  const status = result.status ?? result.statusCode ?? result.http_status;
  if (typeof status === "number") {
    lines.push(`http_status: ${status}`);
    lines.push(`page_valid: ${status >= 200 && status < 400}`);
  }

  // Page title
  const title =
    result.title ??
    result.page_title ??
    extractFirstMatch(String(result.content ?? result.text ?? ""), /<title[^>]*>([^<]+)<\/title>/i);
  if (title) lines.push(`page_title: ${String(title).slice(0, 120).trim()}`);

  // URL
  const resolvedUrl = result.url ?? result.current_url ?? result.finalUrl ?? args?.url;
  if (resolvedUrl) lines.push(`url: ${resolvedUrl}`);

  // Content presence
  const contentStr = String(result.content ?? result.text ?? result.snapshot ?? "");
  const contentLength = contentStr.length;
  lines.push(`content_length: ${contentLength}`);
  lines.push(`page_valid: ${contentLength > TIMEOUT_CONFIG.CONTENT_LENGTH_THRESHOLD}`);

  // Console errors
  const consoleErrors: string[] = [];
  if (Array.isArray(result.console_errors)) {
    consoleErrors.push(...result.console_errors.map(String));
  } else if (Array.isArray(result.errors)) {
    consoleErrors.push(...result.errors.map(String));
  }
  const uniqueConsoleErrors = [...new Set(consoleErrors)].filter(e => e !== "");
  if (uniqueConsoleErrors.length > 0) {
    lines.push(`console_errors: ${uniqueConsoleErrors.slice(0, SLICE_LIMITS.CONSOLE_ERRORS).join(" | ")}`);
  }

  // Headings
  const headings = extractHeadings(contentStr);
  if (headings.length > 0) {
    lines.push(`headings: ${headings.slice(0, SLICE_LIMITS.HEADINGS).join(" | ")}`);
  }

  // Links
  const links = extractLinks(contentStr);
  if (links.length > 0) {
    lines.push(`links: ${links.slice(0, SLICE_LIMITS.LINKS).join(" | ")}`);
  }

  // Page type heuristic
  const pageType = detectPageType(contentStr, title);
  lines.push(`page_type: ${pageType}`);

  lines.push("[/STRUCTURED_CONTEXT]");
  return lines.join("\n");
}

function extractFirstMatch(text: string, regex: RegExp): string | null {
  const m = text.match(regex);
  return m ? String(m[1]).trim() : null;
}

function extractHeadings(text: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /##\s+(.+)/g,
    /###\s+(.+)/g,
    /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const heading = String(m[1]).trim();
      if (heading && matches.length < 8) matches.push(heading);
    }
  }
  return matches;
}

function extractLinks(text: string): string[] {
  const links: string[] = [];
  const hrefPattern = /href=["']([^"'#][^"']*?)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefPattern.exec(text)) !== null) {
    const href = String(m[1]).trim();
    if (href && !href.startsWith("javascript:") && links.length < 10) {
      links.push(href);
    }
  }
  return links;
}

function detectPageType(content: string, title: any): string {
  const combined = `${String(title ?? "")} ${String(content ?? "")}`.toLowerCase();
  if (combined.includes("404") && combined.includes("not found")) return "error_404";
  if (combined.includes("500") && combined.includes("server error")) return "error_500";
  if (combined.includes("blog") || combined.includes("article") || combined.includes("post")) return "blog_or_article";
  if (combined.includes("homepage") || combined.includes("welcome")) return "home";
  if (combined.includes("login") || combined.includes("sign in")) return "auth";
  return "unknown";
}

// T2: Helper to check if page has meaningful structure even with minimal content
function hasPageStructure(content: string, pageTitle: any): boolean {
  const lowerContent = content.toLowerCase();
  const lowerTitle = String(pageTitle ?? "").toLowerCase();

  // Check for navigation elements
  if (lowerContent.includes("nav") || lowerContent.includes("menu") || lowerContent.includes("header")) {
    return true;
  }

  // Check for any links
  if (lowerContent.includes("href=") || lowerContent.includes("<a")) {
    return true;
  }

  // Check for headings
  if (lowerContent.includes("<h1") || lowerContent.includes("<h2") || lowerContent.includes("<h3")) {
    return true;
  }

  // Check for meaningful title
  if (lowerTitle.length > 10 && !lowerTitle.includes("404") && !lowerTitle.includes("error")) {
    return true;
  }

  // Check for button/interactive elements
  if (lowerContent.includes("button") || lowerContent.includes("click") || lowerContent.includes("submit")) {
    return true;
  }

  return false;
}

// ─── T1: Tool result validator ───────────────────────────────────────────────

export function validateToolResult(
  toolName: string,
  args: any,
  result: any
): ValidatedToolResult {
  const reasons: string[] = [];
  const shortName = String(toolName ?? "").split("__").pop() ?? toolName;

  if (!result || result === null || result === undefined) {
    reasons.push("null_result");
  } else if (typeof result === "object") {
    const status = result.status ?? result.statusCode ?? result.http_status;

    // 404 / error status detection
    if (typeof status === "number" && (status === 404 || status >= 400)) {
      reasons.push("http_error_" + status);
    }
    if (result.error && !result.ok && result.ok !== undefined) {
      reasons.push("tool_reported_error");
    }

    // Empty content detection
    const contentStr = String(result.content ?? result.text ?? result.snapshot ?? "");
    const contentLength = contentStr.length;

    // Extract title for structure checking
    const pageTitle = result.title ?? result.page_title ?? null;

    if (contentStr.trim().length === 0) {
      reasons.push("empty_content");
    } else if (contentLength < 50) {
      // T2: Changed minimal_content from error to warning - allow if page has structure
      const hasStructure = hasPageStructure(contentStr, pageTitle);
      if (!hasStructure) {
        reasons.push("minimal_content_warning");
      }
    }

    // Text-based 404 detection
    const lowerContent = contentStr.toLowerCase();
    if (
      lowerContent.includes("404") &&
      (lowerContent.includes("not found") || lowerContent.includes("page not found"))
    ) {
      if (!reasons.includes("http_error_404")) reasons.push("content_404");
    }

    // Missing expected data for navigate
    if (shortName === "navigate" || shortName === "puppeteer_navigate") {
      if (!result.title && !result.content && !result.snapshot) {
        reasons.push("missing_page_data");
      }
    }

    // Missing data for snapshot / get_snapshot
    if (shortName === "snapshot" || shortName === "get_snapshot" || shortName === "puppeteer_snapshot") {
      if (!result.snapshot && !result.content) {
        reasons.push("missing_snapshot");
      }
    }
  } else if (typeof result === "string" && result.trim().length === 0) {
    reasons.push("empty_string_result");
  }

  const isValid = reasons.length === 0;
  const structuredContext = parseStructuredContext(toolName, args, result);

  // Build retry hint
  let retryHint = "";
  let suggestedRetryArgs: Record<string, any> | undefined;

  if (!isValid) {
    retryHint =
      `TOOL_RESULT_INVALID [tool=${shortName}, reasons=${reasons.join(",")}]\n` +
      `The tool result was invalid or empty. Retry with a corrected approach.\n` +
      `Detected issues: ${reasons.join(", ")}.\n`;

    // T3: Self-correcting navigation — generate URL alternatives
    if (
      (reasons.includes("http_error_404") || reasons.includes("content_404") || reasons.includes("empty_content")) &&
      args?.url
    ) {
      const alternatives = generateNavigationAlternatives(String(args.url), reasons[0]);
      if (alternatives.length > 0) {
        retryHint += `Suggested alternative URLs: ${alternatives.join(", ")}.\n`;
        retryHint += `Try navigating to one of these alternatives instead.\n`;
        suggestedRetryArgs = { ...args, url: alternatives[0] };
      }
    }

    retryHint += `maxRetries=2. Do NOT repeat the exact same call.`;
  }

  return { isValid, reasons, structuredContext, retryHint, suggestedRetryArgs };
}

// ─── T3: Self-correcting navigation — URL alternative generator ──────────────

export function generateNavigationAlternatives(url: string, _reason: string): string[] {
  if (!url) return [];
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
      news: ["blog", "articles"],
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
    // Not a valid URL — skip
  }

  // Deduplicate and remove original
  return deduplicateAndExclude(alternatives, url, SLICE_LIMITS.URL_ALTERNATIVES);
}
