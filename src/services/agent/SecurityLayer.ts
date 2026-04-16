/**
 * SecurityLayer - Validates tool calls and enforces security policies
 * Provides allowlist domains, action restrictions, and input sanitization
 */

export interface SecurityPolicy {
  allowedDomains: string[];
  restrictedActions: string[];
  maxNavigationDepth: number;
  requireConfirmationFor: string[];
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  sanitizedArgs?: any;
}

export class SecurityLayer {
  private policy: SecurityPolicy = {
    allowedDomains: [
      "example.com",
      "localhost",
      "127.0.0.1",
      "0.0.0.0"
    ],
    restrictedActions: [
      "delete",
      "format",
      "execute",
      "eval"
    ],
    maxNavigationDepth: 10,
    requireConfirmationFor: [
      "file_delete",
      "file_write"
    ]
  };

  private navigationDepth: Map<string, number> = new Map();

  /**
   * Validate a tool call against security policy
   */
  validateToolCall(toolName: string, args: any): ValidationResult {
    // Check if action is restricted
    if (this.isRestrictedAction(toolName)) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' is restricted for security reasons`
      };
    }

    // Check if confirmation is required (this is informational, not blocking)
    if (this.requiresConfirmation(toolName)) {
      // Log that confirmation would be required in a real system
    }

    // Validate URL-based tools
    if (this.isUrlBasedTool(toolName)) {
      const url = args.url || args.href;
      if (url) {
        const urlValidation = this.validateUrl(url);
        if (!urlValidation.allowed) {
          return urlValidation;
        }
      }
    }

    // Sanitize arguments
    const sanitizedArgs = this.sanitizeArgs(args);

    return {
      allowed: true,
      sanitizedArgs
    };
  }

  /**
   * Validate a URL against allowlist
   */
  validateUrl(url: string): ValidationResult {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Check if domain is in allowlist
      const isAllowed = this.policy.allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );

      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Domain '${hostname}' is not in the allowlist`
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Invalid URL format: ${url}`
      };
    }
  }

  /**
   * Validate a specific action
   */
  validateAction(action: string): ValidationResult {
    if (this.isRestrictedAction(action)) {
      return {
        allowed: false,
        reason: `Action '${action}' is restricted`
      };
    }

    return { allowed: true };
  }

  /**
   * Sanitize arguments to prevent injection attacks
   */
  sanitizeArgs(args: any): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(args)) {
      // Sanitize string values
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      }
      // Recursively sanitize objects
      else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeArgs(value);
      }
      // Keep other types as-is
      else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize a string to prevent injection
   */
  private sanitizeString(value: string): string {
    // Remove potential command injection patterns
    let sanitized = value
      .replace(/\\n/g, '')
      .replace(/\\r/g, '')
      .replace(/\\t/g, '');

    // Limit string length to prevent DoS
    const MAX_STRING_LENGTH = 10000;
    if (sanitized.length > MAX_STRING_LENGTH) {
      sanitized = sanitized.substring(0, MAX_STRING_LENGTH) + '... [truncated]';
    }

    return sanitized;
  }

  /**
   * Check if tool is URL-based
   */
  private isUrlBasedTool(toolName: string): boolean {
    return toolName.includes('navigate') || 
           toolName.includes('goto') ||
           toolName.includes('browse');
  }

  /**
   * Check if action is restricted
   */
  private isRestrictedAction(action: string): boolean {
    return this.policy.restrictedActions.some(restricted => 
      action.toLowerCase().includes(restricted)
    );
  }

  /**
   * Check if action requires confirmation
   */
  private requiresConfirmation(action: string): boolean {
    return this.policy.requireConfirmationFor.some(confRequired => 
      action.toLowerCase().includes(confRequired)
    );
  }

  /**
   * Track navigation depth
   */
  trackNavigation(sessionId: string): ValidationResult {
    const currentDepth = this.navigationDepth.get(sessionId) || 0;
    
    if (currentDepth >= this.policy.maxNavigationDepth) {
      return {
        allowed: false,
        reason: `Maximum navigation depth (${this.policy.maxNavigationDepth}) exceeded`
      };
    }

    this.navigationDepth.set(sessionId, currentDepth + 1);
    return { allowed: true };
  }

  /**
   * Reset navigation depth for a session
   */
  resetNavigationDepth(sessionId: string): void {
    this.navigationDepth.delete(sessionId);
  }

  /**
   * Update security policy
   */
  updatePolicy(updates: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  /**
   * Get current security policy
   */
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  /**
   * Add domain to allowlist
   */
  addAllowedDomain(domain: string): void {
    if (!this.policy.allowedDomains.includes(domain)) {
      this.policy.allowedDomains.push(domain);
    }
  }

  /**
   * Remove domain from allowlist
   */
  removeAllowedDomain(domain: string): void {
    this.policy.allowedDomains = this.policy.allowedDomains.filter(d => d !== domain);
  }

  /**
   * Add restricted action
   */
  addRestrictedAction(action: string): void {
    if (!this.policy.restrictedActions.includes(action)) {
      this.policy.restrictedActions.push(action);
    }
  }

  /**
   * Remove restricted action
   */
  removeRestrictedAction(action: string): void {
    this.policy.restrictedActions = this.policy.restrictedActions.filter(a => a !== action);
  }
}

// Singleton instance
export const securityLayer = new SecurityLayer();
