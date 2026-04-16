/**
 * ToolResultNormalizer - Converts raw tool outputs to structured format
 * Provides consistent data structure for model consumption
 */

export type ErrorType = "selector_not_found" | "navigation_failed" | "timeout" | "invalid_args" | "permission_denied" | "network_error";

export interface NormalizedToolResult {
  success: boolean;
  structuredData: any;
  uiPreview: string;
  retryHint?: string;
  nextActionHint?: string;
  errorType?: ErrorType;
}

export class ToolResultNormalizer {
  /**
   * Normalize tool result based on tool name and raw output
   */
  normalize(toolName: string, rawResult: any): NormalizedToolResult {
    // Determine if result indicates success
    const success = this.isSuccess(rawResult);
    
    // Extract structured data based on tool type
    const structuredData = this.extractStructuredData(toolName, rawResult);
    
    // Generate UI-friendly preview
    const uiPreview = this.generateUiPreview(toolName, rawResult, structuredData);
    
    // Determine retry hints if failed
    const retryHint = success ? undefined : this.generateRetryHint(toolName, rawResult);
    
    // Determine next action hint
    const nextActionHint = this.generateNextActionHint(toolName, rawResult, success);
    
    // Classify error type if failed
    const errorType = success ? undefined : this.classifyError(toolName, rawResult);
    
    return {
      success,
      structuredData,
      uiPreview,
      retryHint,
      nextActionHint,
      errorType
    };
  }

  /**
   * Determine if result indicates success
   */
  private isSuccess(rawResult: any): boolean {
    if (!rawResult) return false;
    
    // Check for explicit success flag
    if (rawResult.ok === true || rawResult.success === true) return true;
    if (rawResult.ok === false || rawResult.success === false) return false;
    
    // Check for error field
    if (rawResult.error) return false;
    
    // Check for status code
    if (rawResult.status && rawResult.status >= 400) return false;
    
    // Default to success if no explicit failure indicators
    return true;
  }

  /**
   * Extract structured data based on tool type
   */
  private extractStructuredData(toolName: string, rawResult: any): any {
    // Browser tools (playwright)
    if (toolName.includes("playwright") || toolName.includes("browser")) {
      return this.extractBrowserData(toolName, rawResult);
    }
    
    // File tools
    if (toolName.includes("file")) {
      return this.extractFileData(rawResult);
    }
    
    // Search tools
    if (toolName.includes("search")) {
      return this.extractSearchData(rawResult);
    }
    
    // Default: return as-is
    return rawResult;
  }

  /**
   * Extract data from browser tool results
   */
  private extractBrowserData(toolName: string, rawResult: any): any {
    if (toolName.includes("snapshot")) {
      // Extract page structure from snapshot
      return {
        title: rawResult.title,
        url: rawResult.url,
        elements: rawResult.elements || [],
        refs: rawResult.refs || []
      };
    }
    
    if (toolName.includes("navigate")) {
      return {
        url: rawResult.url,
        title: rawResult.title,
        status: rawResult.status
      };
    }
    
    if (toolName.includes("click")) {
      return {
        clicked: rawResult.clicked || true,
        navigated: rawResult.navigated || false,
        newUrl: rawResult.newUrl
      };
    }
    
    return rawResult;
  }

  /**
   * Extract data from file tool results
   */
  private extractFileData(rawResult: any): any {
    return {
      path: rawResult.path,
      content: rawResult.content,
      size: rawResult.size,
      type: rawResult.type
    };
  }

  /**
   * Extract data from search tool results
   */
  private extractSearchData(rawResult: any): any {
    return {
      query: rawResult.query,
      results: rawResult.results || [],
      total: rawResult.total || 0
    };
  }

  /**
   * Generate UI-friendly preview
   */
  private generateUiPreview(toolName: string, _rawResult: any, structuredData: any): string {
    if (toolName.includes("snapshot")) {
      return `Snapshot: ${structuredData.title || 'Untitled'} (${structuredData.url || 'No URL'})`;
    }
    
    if (toolName.includes("navigate")) {
      return `Navigated to: ${structuredData.url || 'Unknown'}`;
    }
    
    if (toolName.includes("click")) {
      return `Clicked element: ${structuredData.clicked ? 'Success' : 'Failed'}`;
    }
    
    if (toolName.includes("file")) {
      return `File: ${structuredData.path || 'Unknown'} (${structuredData.size || 0} bytes)`;
    }
    
    if (toolName.includes("search")) {
      return `Search: ${structuredData.total || 0} results for "${structuredData.query || 'Unknown'}"`;
    }
    
    // Default preview
    return `Tool ${toolName} completed`;
  }

  /**
   * Generate retry hint based on failure
   */
  private generateRetryHint(toolName: string, rawResult: any): string {
    const errorMsg = rawResult?.error || rawResult?.message || String(rawResult);
    
    if (toolName.includes("click")) {
      if (errorMsg.includes("not found") || errorMsg.includes("selector")) {
        return "Element not found. Take a snapshot first to get the correct ref, then use the ref to click.";
      }
      if (errorMsg.includes("timeout")) {
        return "Click timed out. The element may not be interactable. Try waiting for it to load.";
      }
    }
    
    if (toolName.includes("navigate")) {
      if (errorMsg.includes("timeout")) {
        return "Navigation timed out. The URL may be slow or unreachable.";
      }
      if (errorMsg.includes("404")) {
        return "Page not found (404). Check the URL is correct.";
      }
    }
    
    if (toolName.includes("snapshot")) {
      if (errorMsg.includes("timeout")) {
        return "Snapshot timed out. The page may be slow to load.";
      }
    }
    
    return "Tool execution failed. Check the error message and try a different approach.";
  }

  /**
   * Generate next action hint
   */
  private generateNextActionHint(toolName: string, _rawResult: any, success: boolean): string {
    if (!success) {
      return "Analyze the error and retry with corrected parameters.";
    }
    
    if (toolName.includes("navigate")) {
      return "Take a snapshot to see the page content before taking further actions.";
    }
    
    if (toolName.includes("snapshot")) {
      return "Review the snapshot to find the element you want to interact with, then use its ref to click or interact.";
    }
    
    if (toolName.includes("click")) {
      return "Take another snapshot to see if the page changed or navigation occurred.";
    }
    
    return "Use this tool result to continue with your task.";
  }

  /**
   * Classify error type
   */
  private classifyError(toolName: string, rawResult: any): ErrorType {
    const errorMsg = (rawResult.error || rawResult.message || String(rawResult)).toLowerCase();
    
    if (errorMsg.includes("selector") || errorMsg.includes("not found") || errorMsg.includes("element")) {
      return "selector_not_found";
    }
    
    if (errorMsg.includes("timeout")) {
      return "timeout";
    }
    
    if (errorMsg.includes("permission") || errorMsg.includes("denied") || errorMsg.includes("forbidden")) {
      return "permission_denied";
    }
    
    if (errorMsg.includes("network") || errorMsg.includes("econnrefused") || errorMsg.includes("fetch")) {
      return "network_error";
    }
    
    if (toolName.includes("navigate") && (errorMsg.includes("404") || errorMsg.includes("dns"))) {
      return "navigation_failed";
    }
    
    return "invalid_args";
  }
}

// Singleton instance
export const toolResultNormalizer = new ToolResultNormalizer();
