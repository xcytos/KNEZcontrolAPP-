// ─── ContentExtractionHeuristics.ts ─────────────────────────────────────────────────
// T11: Content Extraction Heuristics — multiple extraction strategies, page type detection,
//     quality scoring for better content extraction from web pages.
// ─────────────────────────────────────────────────────────────────────────────

export type ExtractionStrategy = "html_parse" | "regex_extract" | "json_parse" | "text_only" | "structured";

export interface ExtractionResult {
  content: any;
  strategy: ExtractionStrategy;
  qualityScore: number;
  pageType: string;
  metadata: {
    hasHeadings: boolean;
    hasLinks: boolean;
    hasImages: boolean;
    textLength: number;
    structureDepth: number;
  };
}

/**
 * Page type detection based on content patterns.
 */
export function detectPageType(content: string, url?: string): string {
  const lowerContent = content.toLowerCase();
  const lowerUrl = url?.toLowerCase() ?? "";

  // Blog/article detection
  if (
    lowerContent.includes("article") ||
    lowerContent.includes("blog") ||
    lowerContent.includes("post") ||
    lowerUrl.includes("/blog/") ||
    lowerUrl.includes("/article/")
  ) {
    return "blog";
  }

  // E-commerce detection
  if (
    lowerContent.includes("price") ||
    lowerContent.includes("add to cart") ||
    lowerContent.includes("product") ||
    lowerUrl.includes("shop") ||
    lowerUrl.includes("store")
  ) {
    return "ecommerce";
  }

  // Documentation detection
  if (
    lowerContent.includes("documentation") ||
    lowerContent.includes("docs") ||
    lowerContent.includes("api") ||
    lowerUrl.includes("/docs/")
  ) {
    return "documentation";
  }

  // News detection
  if (
    lowerContent.includes("news") ||
    lowerContent.includes("breaking") ||
    lowerUrl.includes("/news/")
  ) {
    return "news";
  }

  // Homepage detection
  if (
    lowerContent.includes("homepage") ||
    lowerContent.includes("welcome") ||
    url === "/" ||
    url?.endsWith(".com") ||
    url?.endsWith(".org")
  ) {
    return "homepage";
  }

  // Error page detection
  if (
    lowerContent.includes("404") ||
    lowerContent.includes("not found") ||
    lowerContent.includes("500") ||
    lowerContent.includes("server error")
  ) {
    return "error";
  }

  return "generic";
}

/**
 * Extract content using multiple strategies and return best result.
 */
export function extractContent(content: string, url?: string): ExtractionResult {
  const pageType = detectPageType(content, url);

  // Try different extraction strategies
  const strategies: ExtractionStrategy[] = ["structured", "html_parse", "text_only"];
  let bestResult: ExtractionResult | null = null;
  let bestScore = 0;

  for (const strategy of strategies) {
    const result = extractWithStrategy(content, strategy, pageType);
    if (result.qualityScore > bestScore) {
      bestScore = result.qualityScore;
      bestResult = result;
    }
  }

  return bestResult ?? {
    content,
    strategy: "text_only",
    qualityScore: 0,
    pageType,
    metadata: {
      hasHeadings: false,
      hasLinks: false,
      hasImages: false,
      textLength: content.length,
      structureDepth: 0
    }
  };
}

/**
 * Extract content using specific strategy.
 */
function extractWithStrategy(content: string, strategy: ExtractionStrategy, pageType: string): ExtractionResult {
  const metadata = analyzeContentStructure(content);

  switch (strategy) {
    case "structured":
      return extractStructured(content, pageType, metadata);

    case "html_parse":
      return extractHtml(content, pageType, metadata);

    case "text_only":
      return extractTextOnly(content, pageType, metadata);

    default:
      return {
        content,
        strategy,
        qualityScore: 0,
        pageType,
        metadata
      };
  }
}

/**
 * Analyze content structure for metadata.
 */
function analyzeContentStructure(content: string): ExtractionResult["metadata"] {
  const hasHeadings = /<h[1-6]/i.test(content);
  const hasLinks = /<a\s+href/i.test(content);
  const hasImages = /<img/i.test(content);

  const textContent = content.replace(/<[^>]*>/g, "").trim();
  const textLength = textContent.length;

  // Calculate structure depth (nesting level)
  const maxDepth = calculateStructureDepth(content);

  return {
    hasHeadings,
    hasLinks,
    hasImages,
    textLength,
    structureDepth: maxDepth
  };
}

/**
 * Calculate maximum nesting depth of HTML structure.
 */
function calculateStructureDepth(content: string): number {
  let depth = 0;
  let maxDepth = 0;
  let inTag = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === "<") {
      inTag = true;
    } else if (char === ">") {
      inTag = false;
    } else if (!inTag) {
      // Skip content between tags
      continue;
    }

    // Count opening tags (simplified)
    if (inTag && char === "<" && content[i + 1] !== "/") {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    } else if (inTag && char === "<" && content[i + 1] === "/") {
      depth--;
    }
  }

  return maxDepth;
}

/**
 * Extract structured content (headings, paragraphs, lists).
 */
function extractStructured(content: string, pageType: string, metadata: ExtractionResult["metadata"]): ExtractionResult {
  const structured: Record<string, any> = {
    headings: [] as string[],
    paragraphs: [] as string[],
    links: [] as { text: string; href: string }[],
    metadata
  };

  // Extract headings
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    structured.headings.push({
      level: match[1],
      text: match[2].replace(/<[^>]*>/g, "").trim()
    });
  }

  // Extract paragraphs
  const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
  while ((match = paragraphRegex.exec(content)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, "").trim();
    if (text.length > 20) {
      structured.paragraphs.push(text);
    }
  }

  // Extract links
  const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;
  while ((match = linkRegex.exec(content)) !== null) {
    structured.links.push({
      href: match[1],
      text: match[2].replace(/<[^>]*>/g, "").trim()
    });
  }

  const qualityScore = calculateQualityScore(structured, pageType);

  return {
    content: structured,
    strategy: "structured",
    qualityScore,
    pageType,
    metadata
  };
}

/**
 * Extract HTML content (preserving structure).
 */
function extractHtml(content: string, pageType: string, metadata: ExtractionResult["metadata"]): ExtractionResult {
  // Remove scripts and styles
  const cleaned = content
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<!--.*?-->/gs, "");

  const qualityScore = calculateQualityScore(cleaned, pageType);

  return {
    content: cleaned,
    strategy: "html_parse",
    qualityScore,
    pageType,
    metadata
  };
}

/**
 * Extract text only (strip all HTML).
 */
function extractTextOnly(content: string, pageType: string, metadata: ExtractionResult["metadata"]): ExtractionResult {
  const text = content
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const qualityScore = calculateQualityScore(text, pageType);

  return {
    content: text,
    strategy: "text_only",
    qualityScore,
    pageType,
    metadata
  };
}

/**
 * Calculate quality score for extracted content.
 */
function calculateQualityScore(content: any, pageType: string): number {
  let score = 0;

  if (typeof content === "string") {
    // Text content score
    const length = content.length;
    score += Math.min(length / 500, 5);

    // Penalize very short content
    if (length < 50) score -= 3;
  } else if (typeof content === "object" && content !== null) {
    // Structured content score
    if (content.headings && content.headings.length > 0) score += 2;
    if (content.paragraphs && content.paragraphs.length > 0) score += 2;
    if (content.links && content.links.length > 0) score += 1;

    // Page type bonus
    if (pageType === "blog" && content.headings?.length > 0) score += 1;
    if (pageType === "ecommerce" && content.links?.length > 0) score += 1;
  }

  return Math.max(0, Math.min(10, score));
}

/**
 * Get recommended extraction strategy for page type.
 */
export function getRecommendedStrategy(pageType: string): ExtractionStrategy {
  const strategies: Record<string, ExtractionStrategy> = {
    blog: "structured",
    article: "structured",
    documentation: "structured",
    ecommerce: "html_parse",
    news: "structured",
    homepage: "html_parse",
    error: "text_only",
    generic: "structured"
  };

  return strategies[pageType] ?? "structured";
}
