// ─── ErrorClassifier.ts ─────────────────────────────────────────────────
// T13: Error Classification System — defines error taxonomy, severity levels,
//     recovery suggestions for better error handling and user guidance.
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorCategory = "network" | "parse" | "validation" | "execution" | "timeout" | "mcp" | "unknown";
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface ClassifiedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  context: Record<string, any>;
  recoverySuggestions: string[];
  canRetry: boolean;
  retryStrategy?: "same" | "modified_args" | "alternative_tool" | "fallback";
}

/**
 * Error taxonomy for classification
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  recoverySuggestions: string[];
  canRetry: boolean;
  retryStrategy?: "same" | "modified_args" | "alternative_tool" | "fallback";
}> = [
  // Network errors
  {
    pattern: /timeout/i,
    category: "timeout",
    severity: "error",
    code: "TIMEOUT",
    recoverySuggestions: [
      "Retry with longer timeout",
      "Check network connectivity",
      "Try alternative URL or endpoint",
      "Use cached content if available"
    ],
    canRetry: true,
    retryStrategy: "modified_args"
  },
  {
    pattern: /ECONNREFUSED|connection refused/i,
    category: "network",
    severity: "critical",
    code: "CONN_REFUSED",
    recoverySuggestions: [
      "Check if service is running",
      "Verify server address and port",
      "Check firewall settings",
      "Try alternative endpoint"
    ],
    canRetry: true,
    retryStrategy: "same"
  },
  {
    pattern: /ENOTFOUND|getaddrinfo failed/i,
    category: "network",
    severity: "error",
    code: "DNS_FAILURE",
    recoverySuggestions: [
      "Check URL spelling",
      "Verify domain exists",
      "Try alternative URL",
      "Check DNS settings"
    ],
    canRetry: true,
    retryStrategy: "same"
  },
  {
    pattern: /network|fetch failed/i,
    category: "network",
    severity: "error",
    code: "NETWORK_ERROR",
    recoverySuggestions: [
      "Check network connection",
      "Retry the request",
      "Use alternative method"
    ],
    canRetry: true,
    retryStrategy: "same"
  },

  // Parse errors
  {
    pattern: /invalid json|json parse/i,
    category: "parse",
    severity: "error",
    code: "INVALID_JSON",
    recoverySuggestions: [
      "JSON repair was attempted but failed",
      "Check response format",
      "Try alternative extraction method",
      "Contact API provider"
    ],
    canRetry: false
  },
  {
    pattern: /mcp_invalid_tool_call_json/i,
    category: "parse",
    severity: "error",
    code: "INVALID_TOOL_CALL_JSON",
    recoverySuggestions: [
      "Model emitted invalid tool_call JSON",
      "System will retry with correction",
      "No action needed - auto-recovering"
    ],
    canRetry: true,
    retryStrategy: "same"
  },
  {
    pattern: /mcp_invalid_tool_arguments_json/i,
    category: "parse",
    severity: "error",
    code: "INVALID_TOOL_ARGS_JSON",
    recoverySuggestions: [
      "Tool arguments were invalid JSON",
      "System will retry with correction",
      "No action needed - auto-recovering"
    ],
    canRetry: true,
    retryStrategy: "same"
  },

  // Validation errors
  {
    pattern: /404|not found/i,
    category: "validation",
    severity: "error",
    code: "NOT_FOUND",
    recoverySuggestions: [
      "Check URL or path",
      "Try alternative URL",
      "Navigate to parent directory",
      "Check if resource exists"
    ],
    canRetry: true,
    retryStrategy: "modified_args"
  },
  {
    pattern: /401|unauthorized/i,
    category: "validation",
    severity: "error",
    code: "UNAUTHORIZED",
    recoverySuggestions: [
      "Check authentication credentials",
      "Verify API key or token",
      "Refresh authentication",
      "Contact administrator"
    ],
    canRetry: true,
    retryStrategy: "same"
  },
  {
    pattern: /403|forbidden/i,
    category: "validation",
    severity: "error",
    code: "FORBIDDEN",
    recoverySuggestions: [
      "Check permissions",
      "Verify access rights",
      "Contact administrator",
      "Use alternative account"
    ],
    canRetry: false
  },
  {
    pattern: /500|server error|internal error/i,
    category: "validation",
    severity: "critical",
    code: "SERVER_ERROR",
    recoverySuggestions: [
      "Server encountered an error",
      "Retry after a delay",
      "Contact service provider",
      "Use alternative service"
    ],
    canRetry: true,
    retryStrategy: "same"
  },
  {
    pattern: /empty_content|minimal_content/i,
    category: "validation",
    severity: "warning",
    code: "EMPTY_CONTENT",
    recoverySuggestions: [
      "Page or response had minimal content",
      "Try alternative extraction method",
      "Wait for dynamic content to load",
      "Check if page requires JavaScript"
    ],
    canRetry: true,
    retryStrategy: "modified_args"
  },
  {
    pattern: /content_404/i,
    category: "validation",
    severity: "error",
    code: "CONTENT_404",
    recoverySuggestions: [
      "Page content indicates 404 error",
      "Try alternative URL",
      "Navigate to parent path",
      "Check if page was moved"
    ],
    canRetry: true,
    retryStrategy: "modified_args"
  },

  // Execution errors
  {
    pattern: /tool_execution_exception/i,
    category: "execution",
    severity: "error",
    code: "TOOL_EXECUTION_FAILED",
    recoverySuggestions: [
      "Tool execution encountered an exception",
      "Check tool arguments",
      "Try alternative tool",
      "Report to developer"
    ],
    canRetry: true,
    retryStrategy: "alternative_tool"
  },
  {
    pattern: /tool_reported_error/i,
    category: "execution",
    severity: "error",
    code: "TOOL_REPORTED_ERROR",
    recoverySuggestions: [
      "Tool itself reported an error",
      "Check tool-specific documentation",
      "Try alternative approach",
      "Modify tool arguments"
    ],
    canRetry: true,
    retryStrategy: "modified_args"
  },

  // MCP errors
  {
    pattern: /mcp_handshake_failed/i,
    category: "mcp",
    severity: "critical",
    code: "MCP_HANDSHAKE_FAILED",
    recoverySuggestions: [
      "MCP server handshake failed",
      "Check MCP server is running",
      "Verify MCP server configuration",
      "Restart MCP server"
    ],
    canRetry: true,
    retryStrategy: "same"
  },
  {
    pattern: /mcp_server_not_found/i,
    category: "mcp",
    severity: "critical",
    code: "MCP_SERVER_NOT_FOUND",
    recoverySuggestions: [
      "MCP server not found",
      "Check server ID",
      "Verify server is registered",
      "Add server to configuration"
    ],
    canRetry: false
  },
  {
    pattern: /mcp_tool_not_found/i,
    category: "mcp",
    severity: "error",
    code: "MCP_TOOL_NOT_FOUND",
    recoverySuggestions: [
      "Tool not found on MCP server",
      "Check tool name spelling",
      "Verify server exposes this tool",
      "Use alternative tool"
    ],
    canRetry: false
  }
];

/**
 * Classify an error based on error message and context.
 */
export function classifyError(error: string | Error, context: Record<string, any> = {}): ClassifiedError {
  const errorMessage = typeof error === "string" ? error : error.message ?? String(error);
  const lowerError = errorMessage.toLowerCase();

  // Try to match against known patterns
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(lowerError)) {
      return {
        category: pattern.category,
        severity: pattern.severity,
        code: pattern.code,
        message: errorMessage,
        context,
        recoverySuggestions: pattern.recoverySuggestions,
        canRetry: pattern.canRetry,
        retryStrategy: pattern.retryStrategy
      };
    }
  }

  // Default classification for unknown errors
  return {
    category: "unknown",
    severity: "error",
    code: "UNKNOWN_ERROR",
    message: errorMessage,
    context,
    recoverySuggestions: [
      "An unknown error occurred",
      "Check error details",
      "Try alternative approach",
      "Report to developer"
    ],
    canRetry: true,
    retryStrategy: "same"
  };
}

/**
 * Aggregate similar errors for pattern detection.
 */
export class ErrorAggregator {
  private errorCounts: Map<string, { count: number; lastSeen: Date; samples: string[] }> = new Map();

  recordError(error: ClassifiedError): void {
    const key = `${error.category}:${error.code}`;
    const existing = this.errorCounts.get(key);

    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
      if (existing.samples.length < 5) {
        existing.samples.push(error.message);
      }
    } else {
      this.errorCounts.set(key, {
        count: 1,
        lastSeen: new Date(),
        samples: [error.message]
      });
    }
  }

  getErrorPatterns(): Array<{ key: string; count: number; lastSeen: Date; samples: string[] }> {
    return Array.from(this.errorCounts.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  getFrequentErrors(threshold: number = 3): Array<{ key: string; count: number; lastSeen: Date; samples: string[] }> {
    return this.getErrorPatterns().filter(e => e.count >= threshold);
  }

  clear(): void {
    this.errorCounts.clear();
  }

  getErrorRate(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    let recentCount = 0;

    for (const data of this.errorCounts.values()) {
      if (data.lastSeen.getTime() > oneMinuteAgo) {
        recentCount += data.count;
      }
    }

    return recentCount;
  }
}

// Global instance
export const errorAggregator = new ErrorAggregator();
